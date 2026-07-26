"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

const MIN_PASSWORD_LENGTH = 8;
type SetupCodeType = "invite" | "recovery";

export default function AcceptAccessInvitePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingInvite, setCheckingInvite] = useState(true);
  const [requiresCode, setRequiresCode] = useState(true);
  const [codeType, setCodeType] = useState<SetupCodeType>("invite");
  const [email, setEmail] = useState("");
  const [oneTimeCode, setOneTimeCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const requestedType =
      params.get("type") === "recovery" ? "recovery" : "invite";
    const requestedEmail = String(params.get("email") || "")
      .trim()
      .toLowerCase();
    const setupEmailLink = params.has("type") || params.has("email");

    setCodeType(requestedType);
    setEmail(requestedEmail);
    setRequiresCode(setupEmailLink);

    function applySession(nextSession: Session | null) {
      if (!alive) return;
      setSession(nextSession);
      if (!setupEmailLink && nextSession) setRequiresCode(false);
      setCheckingInvite(false);
    }

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        applySession(nextSession);
      },
    );

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        applySession(data.session);
      })
      .catch(() => {
        if (!alive) return;
        setMessage(
          "This invitation could not be verified. Ask the LifeSwitch owner to send a new invitation.",
        );
        setCheckingInvite(false);
      });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function verifySetupCode() {
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = oneTimeCode.replace(/\s+/g, "");

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setMessage("Enter the email address that received the setup message.");
      return;
    }
    if (!/^[0-9]{6,8}$/.test(normalizedCode)) {
      setMessage("Enter the one-time code from the setup message.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedCode,
        type: codeType,
      });
      if (error || !data.session) throw error || new Error();
      if (
        String(data.session.user.email || "").toLowerCase() !== normalizedEmail
      ) {
        await supabase.auth.signOut();
        throw new Error();
      }
      setSession(data.session);
      setOneTimeCode("");
      setRequiresCode(false);
      window.history.replaceState(null, "", "/auth/accept-invite");
    } catch {
      setMessage(
        "That setup code is invalid or expired. Ask the LifeSwitch owner to send a new password setup email.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createPassword() {
    setMessage("");

    if (!session) {
      setMessage(
        "Verify the one-time setup code before creating your password.",
      );
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage(
        `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`,
      );
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirmPassword("");
      setComplete(true);
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The password could not be created. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const recoveryMode = !checkingInvite && codeType === "recovery";

  return (
    <main className="mx-auto min-h-screen max-w-2xl p-4 py-10 sm:py-16">
      <section className="rounded-2xl border bg-background p-5 shadow-sm sm:p-7">
        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          LifeSwitch
        </div>

        <h1 className="mt-2 text-2xl font-semibold">
          {checkingInvite
            ? "LifeSwitch account security"
            : recoveryMode
              ? "Change your LifeSwitch password"
              : "Your LifeSwitch access was approved"}
        </h1>

        <div className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
          <p>
            LifeSwitch is a private app for planning, nutrition, training,
            measurements, reflection, and personal progress.
          </p>
          <p>
            {recoveryMode
              ? "Use the one-time code from your email, then choose a new password. Your information remains private unless you explicitly share it through LifeSwitch People."
              : "Use the one-time code from your setup email, then create a password to finish setting up your account. Your information remains private unless you explicitly share it through LifeSwitch People."}
          </p>
        </div>

        {checkingInvite ? (
          <div className="mt-5 rounded-xl border p-4 text-sm text-muted-foreground">
            Verifying invitation…
          </div>
        ) : complete ? (
          <div className="mt-5 grid gap-4">
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm">
              {recoveryMode
                ? "Your password has been changed."
                : "Your password has been created. Your LifeSwitch account is ready."}
            </div>
            <Link
              href="/"
              className="inline-flex w-fit rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted/40"
            >
              Continue to LifeSwitch
            </Link>
          </div>
        ) : requiresCode || !session ? (
          <div className="mt-5 rounded-2xl border p-4 sm:p-5">
            <div className="text-sm font-semibold">Verify your setup code</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Automated email security checks cannot use this code.
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span>Email</span>
                <input
                  className="w-full rounded-xl border bg-background px-3 py-2"
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
              <label className="grid gap-1 text-sm">
                <span>One-time code</span>
                <input
                  className="w-full rounded-xl border bg-background px-3 py-2 font-mono tracking-[0.2em]"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={oneTimeCode}
                  onChange={(event) => setOneTimeCode(event.target.value)}
                  disabled={busy}
                />
              </label>
              <button
                type="button"
                className="w-fit rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
                onClick={() => void verifySetupCode()}
                disabled={busy || !email.trim() || !oneTimeCode.trim()}
              >
                {busy ? "Verifying…" : "Verify code"}
              </button>
            </div>
          </div>
        ) : session ? (
          <div className="mt-5 rounded-2xl border p-4 sm:p-5">
            <div className="text-sm font-semibold">
              {recoveryMode ? "Create a new password" : "Create your password"}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Account: {session.user.email}
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span>Password</span>
                <input
                  className="w-full rounded-xl border bg-background px-3 py-2"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span>Confirm password</span>
                <input
                  className="w-full rounded-xl border bg-background px-3 py-2"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={busy}
                />
              </label>
              <div className="text-xs text-muted-foreground">
                Use at least {MIN_PASSWORD_LENGTH} characters.
              </div>
              <button
                type="button"
                className="w-fit rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
                onClick={() => void createPassword()}
                disabled={busy || !password || !confirmPassword}
              >
                {busy
                  ? recoveryMode
                    ? "Saving password…"
                    : "Creating password…"
                  : recoveryMode
                    ? "Save new password"
                    : "Create password"}
              </button>
            </div>
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-xl border bg-muted/20 p-3 text-sm">
            {message}
          </div>
        ) : null}
      </section>
    </main>
  );
}
