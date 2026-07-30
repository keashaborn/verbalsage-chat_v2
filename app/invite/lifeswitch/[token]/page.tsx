"use client";

import * as React from "react";
import Link from "next/link";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/auth/TurnstileWidget";
import {
  PublicAuthNotice,
  PublicAuthShell,
  PUBLIC_AUTH_PRIMARY_ACTION_CLASS,
  PUBLIC_AUTH_SECONDARY_ACTION_CLASS,
  PUBLIC_AUTH_SECTION_CLASS,
} from "@/components/auth/PublicAuthShell";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";

type InvitePreview = {
  invitation_id: string;
  created_by_user_id: string;
  creator_display_name: string;
  relationship_kind: string;
  label: string;
  notes: string;
  status: string;
  expires_at: string;
  created_at: string;
};

function kindLabel(kind?: string) {
  return String(kind || "friend").replaceAll("_", " ");
}

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetch(url, { cache: "no-store", ...(init || {}) });
  const text = await r.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!r.ok) {
    throw new Error("The invitation could not be loaded.");
  }
  return data;
}

async function syncIdentityBestEffort() {
  try {
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    if (!u?.id) return;

    const full_name = String(u?.user_metadata?.full_name || "").trim();
    const email = String(u?.email || "").trim();

    await authFetch("/api/identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name, email }),
    });
  } catch {
    // best effort only
  }
}

export default function LifeSwitchInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolved = React.use(params);
  const token = String(resolved?.token || "").trim();

  const [preview, setPreview] = React.useState<InvitePreview | null>(null);
  const [sessionUserId, setSessionUserId] = React.useState("");
  const [mode, setMode] = React.useState<"login" | "request">("login");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loginToken, setLoginToken] = React.useState("");
  const loginTurnstileRef = React.useRef<TurnstileWidgetHandle>(null);
  const [accessRequestToken, setAccessRequestToken] = React.useState("");
  const accessRequestTurnstileRef = React.useRef<TurnstileWidgetHandle>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);
  const [message, setMessage] = React.useState("");

  async function load() {
    setLoading(true);
    setMessage("");

    try {
      const p = await fetchJson(
        `/api/lifeswitch/people/invitations/preview?token=${encodeURIComponent(token)}`,
      );
      setPreview(p as InvitePreview);

      const { data } = await supabase.auth.getUser();
      setSessionUserId(data?.user?.id || "");
    } catch {
      setPreview(null);
      setMessage("");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user?.id || "");
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function login() {
    if (!loginToken) {
      setMessage("Complete the security verification before logging in.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken: loginToken },
      });
      if (error) throw error;
      await syncIdentityBestEffort();
      await load();
    } catch {
      setMessage("The email or password was not accepted.");
    } finally {
      loginTurnstileRef.current?.reset();
      setLoginToken("");
      setBusy(false);
    }
  }

  async function requestAccess() {
    if (!accessRequestToken) {
      setMessage(
        "Complete the security verification before requesting access.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          email,
          full_name: fullName,
          message: "Requested from a LifeSwitch relationship invitation.",
          turnstile_token: accessRequestToken,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error === "invalid_access_request"
            ? "Enter a valid email address."
            : payload?.error === "access_request_verification_failed"
              ? "Security verification failed. Complete it again and retry."
              : "The request could not be submitted. Try again.",
        );
      }
      setFullName("");
      setMessage(
        "Request received. If the LifeSwitch Owner approves it, you will receive an email to create your password. Reopen this invitation link after signing in.",
      );
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The request could not be submitted. Try again.",
      );
    } finally {
      accessRequestTurnstileRef.current?.reset();
      setAccessRequestToken("");
      setBusy(false);
    }
  }

  async function acceptInvite() {
    setBusy(true);
    setMessage("");
    try {
      await syncIdentityBestEffort();
      const r = await authFetch("/api/lifeswitch/people/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        cache: "no-store",
        body: JSON.stringify({ token }),
      });

      if (!r.ok) {
        throw new Error("The invitation could not be accepted.");
      }

      setAccepted(true);
    } catch {
      setMessage(
        "The invitation could not be accepted. It may have expired or already been used.",
      );
    } finally {
      setBusy(false);
    }
  }

  const inviter = preview?.creator_display_name || "Someone";
  const isExpiredOrClosed = preview && preview.status !== "pending";

  return (
    <PublicAuthShell
      title={
        preview
          ? `${inviter} invited you to LifeSwitch`
          : "LifeSwitch invitation"
      }
      intro={
        <>
          <p>
            LifeSwitch is a private app for planning, tracking, reflection, and
            personal change work.
          </p>
          <p>
            It helps organize plans, training, nutrition, measurements,
            relationships, and progress over time.
          </p>
          {preview ? (
            <p>
              Accepting this invitation connects you with {inviter} in
              LifeSwitch.
            </p>
          ) : null}
        </>
      }
    >
      {loading ? (
        <div
          className={`${PUBLIC_AUTH_SECTION_CLASS} text-sm text-muted-foreground`}
          role="status"
        >
          Loading invitation…
        </div>
      ) : preview ? (
        <div className={PUBLIC_AUTH_SECTION_CLASS}>
          <div className="text-sm font-semibold">Invitation details</div>
          <dl className="mt-2 grid gap-1 text-sm text-muted-foreground">
            <div>
              <dt className="inline font-medium text-foreground">From:</dt>{" "}
              <dd className="inline">{inviter}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">
                Connection type:
              </dt>{" "}
              <dd className="inline">{kindLabel(preview.relationship_kind)}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">Status:</dt>{" "}
              <dd className="inline">{preview.status}</dd>
            </div>
            {preview.expires_at ? (
              <div>
                <dt className="inline font-medium text-foreground">Expires:</dt>{" "}
                <dd className="inline">
                  {new Date(preview.expires_at).toLocaleDateString()}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : (
        <div className={`${PUBLIC_AUTH_SECTION_CLASS} grid gap-4`}>
          <PublicAuthNotice tone="error">
            This invitation could not be loaded. Ask the sender to create a new
            invitation.
          </PublicAuthNotice>
          <Link
            href="/"
            className={`${PUBLIC_AUTH_SECONDARY_ACTION_CLASS} w-fit`}
          >
            Return to LifeSwitch
          </Link>
        </div>
      )}

      {message ? (
        <div className="mt-4">
          <PublicAuthNotice>{message}</PublicAuthNotice>
        </div>
      ) : null}

      {accepted ? (
        <div className={`${PUBLIC_AUTH_SECTION_CLASS} grid gap-4`}>
          <PublicAuthNotice tone="success">
            You are now connected with {inviter}.
          </PublicAuthNotice>
          <Link
            href="/lifeswitch/people"
            className={`${PUBLIC_AUTH_PRIMARY_ACTION_CLASS} w-fit`}
          >
            Go to LifeSwitch People
          </Link>
        </div>
      ) : null}

      {!accepted && preview && isExpiredOrClosed ? (
        <div className={PUBLIC_AUTH_SECTION_CLASS}>
          <PublicAuthNotice>
            This invitation is no longer available.
          </PublicAuthNotice>
        </div>
      ) : null}

      {!accepted && preview && !isExpiredOrClosed ? (
        <div className={PUBLIC_AUTH_SECTION_CLASS}>
          {sessionUserId ? (
            <div className="grid gap-4">
              <div className="text-sm text-muted-foreground">
                You are signed in and can accept this invitation.
              </div>
              <button
                type="button"
                onClick={() => void acceptInvite()}
                disabled={busy}
                className={`${PUBLIC_AUTH_PRIMARY_ACTION_CLASS} w-fit`}
              >
                {busy ? "Accepting…" : "Accept invitation"}
              </button>
            </div>
          ) : (
            <>
              <div className="text-sm font-semibold">
                Log in or request access to accept
              </div>

              <div
                className="mt-3 flex border-b border-border/70"
                role="tablist"
                aria-label="Invitation access"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  className={`min-h-11 border-b-2 px-2 text-sm font-medium ${
                    mode === "login"
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setMode("login");
                    setLoginToken("");
                    setAccessRequestToken("");
                    setMessage("");
                  }}
                  disabled={busy}
                >
                  Log in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "request"}
                  className={`min-h-11 border-b-2 px-2 text-sm font-medium ${
                    mode === "request"
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setMode("request");
                    setLoginToken("");
                    setAccessRequestToken("");
                    setMessage("");
                  }}
                  disabled={busy}
                >
                  Request access
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                {mode === "request" ? (
                  <>
                    <label className="grid gap-1.5 text-sm">
                      <span>
                        Full name{" "}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </span>
                      <input
                        className="min-h-11 w-full rounded-lg border bg-background px-3 py-2"
                        autoComplete="name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        disabled={busy}
                      />
                    </label>
                    <p className="text-sm leading-6 text-muted-foreground">
                      New accounts require approval from the LifeSwitch owner.
                      After creating your password, reopen this invitation link.
                    </p>
                  </>
                ) : null}

                <label className="grid gap-1.5 text-sm">
                  <span>Email</span>
                  <input
                    className="min-h-11 w-full rounded-lg border bg-background px-3 py-2"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={busy}
                  />
                </label>

                {mode === "login" ? (
                  <>
                    <label className="grid gap-1.5 text-sm">
                      <span>Password</span>
                      <input
                        className="min-h-11 w-full rounded-lg border bg-background px-3 py-2"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={busy}
                      />
                    </label>
                    <TurnstileWidget
                      ref={loginTurnstileRef}
                      action="auth_login"
                      onToken={setLoginToken}
                    />
                  </>
                ) : (
                  <TurnstileWidget
                    ref={accessRequestTurnstileRef}
                    action="request_access"
                    onToken={setAccessRequestToken}
                  />
                )}

                <button
                  type="button"
                  className={`${PUBLIC_AUTH_PRIMARY_ACTION_CLASS} w-fit`}
                  onClick={() =>
                    mode === "login" ? void login() : void requestAccess()
                  }
                  disabled={
                    busy ||
                    !email ||
                    (mode === "login" && (!password || !loginToken)) ||
                    (mode === "request" && !accessRequestToken)
                  }
                >
                  {busy
                    ? "Working…"
                    : mode === "login"
                      ? "Log in"
                      : "Send access request"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </PublicAuthShell>
  );
}
