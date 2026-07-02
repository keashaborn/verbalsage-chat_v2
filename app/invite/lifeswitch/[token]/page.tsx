"use client";

import * as React from "react";
import Link from "next/link";
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
    const detail = typeof data === "object" && data ? data.detail || data.error : text;
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
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);
  const [message, setMessage] = React.useState("");

  async function load() {
    setLoading(true);
    setMessage("");

    try {
      const p = await fetchJson(`/api/lifeswitch/people/invitations/preview?token=${encodeURIComponent(token)}`);
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
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await syncIdentityBestEffort();
      await load();
    } catch (e: any) {
      setMessage(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function signup() {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName || null } },
      });
      if (error) throw error;
      setMessage("Account created. Check your email if confirmation is required, then sign in.");
    } catch (e: any) {
      setMessage(String(e?.message || e));
    } finally {
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
        const detail = typeof data === "object" && data ? data.detail || data.error : text;
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
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          LifeSwitch
        </div>

        <h1 className="mt-2 text-2xl font-semibold">
          {preview ? `${inviter} invited you to LifeSwitch` : "LifeSwitch invitation"}
        </h1>

        <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
          <p>
            LifeSwitch is a private app for planning, tracking, reflection, and personal change work.
          </p>
          <p>
            It helps organize plans, training, nutrition, measurements, relationships, and progress over time.
          </p>
          {preview ? (
            <p>
              Accepting this invitation connects you with {inviter} in LifeSwitch.
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
                <div>Expires: {new Date(preview.expires_at).toLocaleDateString()}</div>
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
                <div className="text-sm font-semibold">Sign in or create account to accept</div>

                <div className="mt-3 flex gap-2 text-sm">
                  <button
                    className={`rounded-lg px-3 py-1 ${mode === "login" ? "bg-muted" : "hover:bg-muted/60"}`}
                    onClick={() => setMode("login")}
                    disabled={busy}
                  >
                    Log in
                  </button>
                  <button
                    className={`rounded-lg px-3 py-1 ${mode === "signup" ? "bg-muted" : "hover:bg-muted/60"}`}
                    onClick={() => setMode("signup")}
                    disabled={busy}
                  >
                    Sign up
                  </button>
                </div>

                <div className="mt-3 grid gap-2">
                  {mode === "signup" ? (
                    <input
                      className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                      placeholder="Full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={busy}
                    />
                  ) : null}

                  <input
                    className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                  />

                  <input
                    className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                  />

                  <button
                    type="button"
                    className="w-fit rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => (mode === "login" ? void login() : void signup())}
                    disabled={busy || !email || !password}
                  >
                    {busy ? "Working…" : mode === "login" ? "Log in" : "Create account"}
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
