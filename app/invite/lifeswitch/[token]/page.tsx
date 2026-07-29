"use client";

import * as React from "react";
import Link from "next/link";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/auth/TurnstileWidget";
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
    const detail =
      typeof data === "object" && data ? data.detail || data.error : text;
    throw new Error(String(detail || `HTTP ${r.status}`));
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
    } catch (e: any) {
      setPreview(null);
      setMessage(String(e?.message || e));
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
    } catch (e: any) {
      setMessage(String(e?.message || e));
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
    } catch (e: any) {
      setMessage(String(e?.message || e));
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

      const text = await r.text().catch(() => "");
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (!r.ok) {
        const detail =
          typeof data === "object" && data ? data.detail || data.error : text;
        throw new Error(String(detail || `HTTP ${r.status}`));
      }

      setAccepted(true);
      setMessage("Invitation accepted.");
    } catch (e: any) {
      setMessage(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const inviter = preview?.creator_display_name || "Someone";
  const isExpiredOrClosed = preview && preview.status !== "pending";

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <div className="rounded-2xl border bg-background p-5 shadow-sm">
        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          LifeSwitch
        </div>

        <h1 className="mt-2 text-2xl font-semibold">
          {preview
            ? `${inviter} invited you to LifeSwitch`
            : "LifeSwitch invitation"}
        </h1>

        <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
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
        </div>

        {loading ? (
          <div className="mt-5 rounded-xl border p-4 text-sm text-muted-foreground">
            Loading invitation…
          </div>
        ) : preview ? (
          <div className="mt-5 rounded-xl border p-4">
            <div className="text-sm font-semibold">Invitation details</div>
            <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
              <div>From: {inviter}</div>
              <div>Connection type: {kindLabel(preview.relationship_kind)}</div>
              <div>Status: {preview.status}</div>
              {preview.expires_at ? (
                <div>
                  Expires: {new Date(preview.expires_at).toLocaleDateString()}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            This invitation could not be loaded.
          </div>
        )}

        {message ? (
          <div className="mt-4 rounded-xl border bg-muted/20 p-3 text-sm">
            {message}
          </div>
        ) : null}

        {accepted ? (
          <div className="mt-5 grid gap-3">
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm">
              You are now connected with {inviter}.
            </div>
            <Link
              href="/lifeswitch/people"
              className="inline-flex w-fit rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted/40"
            >
              Go to LifeSwitch People
            </Link>
          </div>
        ) : null}

        {!accepted && preview && !isExpiredOrClosed ? (
          <div className="mt-5">
            {sessionUserId ? (
              <div className="grid gap-3">
                <div className="text-sm text-muted-foreground">
                  You are signed in and can accept this invitation.
                </div>
                <button
                  type="button"
                  onClick={() => void acceptInvite()}
                  disabled={busy}
                  className="w-fit rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
                >
                  {busy ? "Accepting…" : "Accept invitation"}
                </button>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border p-4">
                <div className="text-sm font-semibold">
                  Log in or request access to accept
                </div>

                <div className="mt-3 flex gap-2 text-sm">
                  <button
                    className={`rounded-lg px-3 py-1 ${mode === "login" ? "bg-muted" : "hover:bg-muted/60"}`}
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
                    className={`rounded-lg px-3 py-1 ${mode === "request" ? "bg-muted" : "hover:bg-muted/60"}`}
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

                <div className="mt-3 grid gap-2">
                  {mode === "request" ? (
                    <>
                      <input
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        placeholder="Full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={busy}
                      />
                      <p className="text-sm text-muted-foreground">
                        New accounts require approval from the LifeSwitch Owner.
                        After creating your password, reopen this invitation
                        link.
                      </p>
                    </>
                  ) : null}

                  <input
                    className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                  />

                  {mode === "login" ? (
                    <>
                      <input
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        placeholder="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={busy}
                      />
                      <TurnstileWidget
                        ref={loginTurnstileRef}
                        action="auth_login"
                        onToken={setLoginToken}
                      />
                    </>
                  ) : null}

                  {mode === "request" ? (
                    <TurnstileWidget
                      ref={accessRequestTurnstileRef}
                      action="request_access"
                      onToken={setAccessRequestToken}
                    />
                  ) : null}

                  <button
                    type="button"
                    className="w-fit rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
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
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
