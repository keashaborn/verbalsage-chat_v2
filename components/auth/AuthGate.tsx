"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/auth/TurnstileWidget";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";
import { applyTheme, DEFAULT_THEME, normalizeThemeValue } from "@/lib/theme";
import {
  normalizeConversationStyle,
  storeConversationStyle,
} from "@/lib/conversationStyle";
import { normalizeSpeechVoice, storeSpeechVoice } from "@/lib/speechSettings";
import {
  VOICE_PRIVACY_NOTICE_STORAGE_KEY,
  VOICE_PRIVACY_NOTICE_VERSION,
} from "@/lib/voicePrivacy";

const MAX_AGE_S = 60 * 60 * 24 * 30; // 30d

type MfaGateState = "clear" | "required" | "unavailable";
type MfaFactorChoice = {
  id: string;
  label: string;
};

function isBadRefreshToken(err: any): boolean {
  const msg = String(err?.message || err || "");
  return msg.toLowerCase().includes("invalid refresh token");
}

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}

function writeCookieRaw(name: string, rawValue: string) {
  document.cookie = `${name}=${rawValue}; Max-Age=${MAX_AGE_S}; path=/; SameSite=Lax`;
}
function writeStringCookie(name: string, value: string) {
  writeCookieRaw(name, encodeURIComponent(String(value)));
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: any;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([p.finally(() => clearTimeout(t)), timeout]);
}

async function fetchOk(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      credentials: "include",
      cache: "no-store",
    });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function applyThemeFromMetadata(md: any) {
  const localTheme = normalizeThemeValue(lsGet("vs_theme"));
  const cloudTheme = normalizeThemeValue(md?.vs_theme);
  applyTheme(cloudTheme || localTheme || DEFAULT_THEME);
}

function applySettingsFromSession(session: any): boolean {
  // Apply supported presentation settings from session metadata without an
  // extra network call. Legacy Vantage fields remain inert historical data.
  try {
    const md: any = session?.user?.user_metadata || {};
    applyThemeFromMetadata(md);

    storeSpeechVoice(normalizeSpeechVoice(md.vs_voice));
    storeConversationStyle(
      normalizeConversationStyle(md.vs_conversation_style),
    );
    lsSet("vs_voice_engine", "openai_tts");

    if (md.vs_voice_privacy_notice_version === VOICE_PRIVACY_NOTICE_VERSION) {
      lsSet(
        VOICE_PRIVACY_NOTICE_STORAGE_KEY,
        JSON.stringify(VOICE_PRIVACY_NOTICE_VERSION),
      );
    }

    const v1: any = session?.user?.user_metadata?.vs_settings_v1;
    if (!v1) return false;

    if (v1.model) {
      writeStringCookie("vs_model", String(v1.model).trim().slice(0, 64));
    }
    return true;
  } catch {
    return false;
  }
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [mfaGate, setMfaGate] = useState<MfaGateState>("clear");
  const [mfaFactors, setMfaFactors] = useState<MfaFactorChoice[]>([]);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);

  const [mode, setMode] = useState<"login" | "request">("login");
  const [busy, setBusy] = useState(false);

  const [accessRequestSubmitted, setAccessRequestSubmitted] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginToken, setLoginToken] = useState("");
  const loginTurnstileRef = useRef<TurnstileWidgetHandle>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [accessRequestToken, setAccessRequestToken] = useState("");
  const accessRequestTurnstileRef = useRef<TurnstileWidgetHandle>(null);
  const [msg, setMsg] = useState("");

  async function syncIdentityBestEffort(s: any) {
    const u = s?.user;
    if (!u?.id) return;

    const full_name = String(u?.user_metadata?.full_name || "").trim();
    const email = String(u?.email || "").trim();

    await withTimeout(
      authFetch("/api/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name, email }),
      }),
      2500,
      "identity.sync",
    );
  }

  async function bootstrapFromSession(s: any | null) {
    setMsg("");

    // Signed out path
    if (!s) {
      setSession(null);
      setMfaGate("clear");
      setMfaFactors([]);
      setMfaFactorId("");
      setMfaCode("");
      return;
    }

    const role = String(s?.user?.app_metadata?.role || "");
    const privilegedAccount = role === "owner" || role === "admin";

    if (privilegedAccount) {
      try {
        const { data: assurance, error: assuranceError } = await withTimeout(
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          4000,
          "supabase.mfa.getAuthenticatorAssuranceLevel",
        );
        if (assuranceError) throw assuranceError;
        if (!assurance?.currentLevel || !assurance?.nextLevel) {
          throw new Error("Authenticator assurance level is unavailable.");
        }

        if (
          assurance.currentLevel === "aal1" &&
          assurance.nextLevel === "aal2"
        ) {
          const { data: factors, error: factorsError } = await withTimeout(
            supabase.auth.mfa.listFactors(),
            4000,
            "supabase.mfa.listFactors",
          );
          if (factorsError) throw factorsError;

          const choices = (factors?.totp || []).map((factor, index) => ({
            id: factor.id,
            label:
              String(factor.friendly_name || "").trim() ||
              `Authenticator ${index + 1}`,
          }));
          if (choices.length === 0) {
            throw new Error("No verified authenticator is available.");
          }

          setSession(s);
          setMfaFactors(choices);
          setMfaFactorId((current) =>
            choices.some((factor) => factor.id === current)
              ? current
              : choices[0].id,
          );
          setMfaCode("");
          setMfaGate("required");
          return;
        }
      } catch {
        setSession(s);
        setMfaGate("unavailable");
        setMsg(
          "Your multi-factor status could not be verified. Retry or sign out.",
        );
        return;
      }
    }

    // Supabase session is the source of truth. API calls attach the bearer token via authFetch.
    setSession(s);
    setMfaGate("clear");
    setMfaFactors([]);
    setMfaFactorId("");
    setMfaCode("");
    // Best-effort, non-blocking extras.
    applySettingsFromSession(s);
    void syncIdentityBestEffort(s);
  }

  async function forceSignedOut() {
    try {
      await withTimeout(supabase.auth.signOut(), 4000, "supabase.signOut");
    } catch {}
    setSession(null);
    setMfaGate("clear");
    setMfaFactors([]);
    setMfaFactorId("");
    setMfaCode("");
  }

  useEffect(() => {
    let alive = true;

    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason: any = (e as any).reason;
      if (isBadRefreshToken(reason)) {
        e.preventDefault?.();
        void forceSignedOut();
      }
    };
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    (async () => {
      try {
        // IMPORTANT: bound this so the UI can never hang forever.
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          4000,
          "supabase.getSession",
        );

        if (!alive) return;

        if (error) {
          if (isBadRefreshToken(error)) await forceSignedOut();
          else setMsg(String(error.message || error));
          await bootstrapFromSession(null);
        } else {
          await bootstrapFromSession(data.session || null);
        }
      } catch (e: any) {
        if (!alive) return;
        if (isBadRefreshToken(e)) await forceSignedOut();
        else
          setMsg(
            "Auth bootstrap timed out. Refresh once; if it repeats, clear site data.",
          );
        await bootstrapFromSession(null);
      } finally {
        if (alive) setBooting(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!alive) return;
      // Run bootstrap; do not let this block render forever (syncServerAuthCookies is bounded).
      void bootstrapFromSession(s || null);
    });

    return () => {
      alive = false;
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleLogin() {
    setMsg("");
    if (!loginToken) {
      setMsg("Complete the security verification before logging in.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken: loginToken },
        }),
        8000,
        "supabase.signInWithPassword",
      );
      if (error) setMsg(error.message);
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      loginTurnstileRef.current?.reset();
      setLoginToken("");
      setBusy(false);
    }
  }

  async function handleAccessRequest() {
    setMsg("");
    if (!accessRequestToken) {
      setMsg("Complete the security verification before requesting access.");
      return;
    }
    setBusy(true);
    try {
      const response = await withTimeout(
        fetch("/api/access-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            email,
            full_name: fullName,
            message: requestMessage,
            turnstile_token: accessRequestToken,
          }),
        }),
        8000,
        "access request",
      );
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
      setMsg("");
      setAccessRequestSubmitted(true);
      setFullName("");
      setRequestMessage("");
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      accessRequestTurnstileRef.current?.reset();
      setAccessRequestToken("");
      setBusy(false);
    }
  }

  async function verifyMfaCode() {
    const code = mfaCode.replace(/\s+/g, "");
    if (!mfaFactorId || !/^[0-9]{6}$/.test(code)) {
      setMsg("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setMfaBusy(true);
    setMsg("");
    try {
      const { error } = await withTimeout(
        supabase.auth.mfa.challengeAndVerify({
          factorId: mfaFactorId,
          code,
        }),
        8000,
        "supabase.mfa.challengeAndVerify",
      );
      if (error) throw error;

      const { data, error: sessionError } = await withTimeout(
        supabase.auth.getSession(),
        4000,
        "supabase.getSession",
      );
      if (sessionError || !data.session) {
        throw sessionError || new Error("Session unavailable.");
      }
      setMfaCode("");
      await bootstrapFromSession(data.session);
    } catch {
      setMsg("That authenticator code was invalid or expired. Try again.");
    } finally {
      setMfaBusy(false);
    }
  }

  async function retryMfaCheck() {
    if (!session) return;
    setMfaBusy(true);
    setMsg("");
    try {
      await bootstrapFromSession(session);
    } finally {
      setMfaBusy(false);
    }
  }

  if (booting) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Do not mount the app until the Supabase session is valid.
  const showApp = !!session && mfaGate === "clear";

  return (
    <>
      {showApp ? children : null}

      {session && mfaGate !== "clear" ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-background p-6 text-foreground shadow-xl">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              LifeSwitch protected account
            </div>
            <h1 className="mt-2 text-xl font-semibold">
              Multi-factor verification
            </h1>

            {mfaGate === "required" ? (
              <>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Enter the current 6-digit code from your authenticator app
                  before opening LifeSwitch.
                </p>

                {mfaFactors.length > 1 && (
                  <label className="mt-4 grid gap-1 text-sm">
                    <span>Authenticator</span>
                    <select
                      className="w-full rounded-xl border bg-background px-3 py-2"
                      value={mfaFactorId}
                      onChange={(event) => setMfaFactorId(event.target.value)}
                      disabled={mfaBusy}
                    >
                      {mfaFactors.map((factor) => (
                        <option key={factor.id} value={factor.id}>
                          {factor.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="mt-4 grid gap-1 text-sm">
                  <span>Authenticator code</span>
                  <input
                    className="w-full rounded-xl border bg-background px-3 py-2 font-mono tracking-[0.2em]"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(event) =>
                      setMfaCode(
                        event.target.value.replace(/[^0-9]/g, "").slice(0, 6),
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !mfaBusy) {
                        void verifyMfaCode();
                      }
                    }}
                    disabled={mfaBusy}
                    autoFocus
                  />
                </label>

                <button
                  type="button"
                  className="mt-4 w-full rounded-xl bg-muted px-3 py-2 hover:bg-muted/60 disabled:opacity-50"
                  onClick={() => void verifyMfaCode()}
                  disabled={mfaBusy || mfaCode.length !== 6}
                >
                  {mfaBusy ? "Verifying…" : "Verify and continue"}
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  LifeSwitch could not confirm the multi-factor status of this
                  protected account. The application remains locked.
                </p>
                <button
                  type="button"
                  className="mt-4 w-full rounded-xl bg-muted px-3 py-2 hover:bg-muted/60 disabled:opacity-50"
                  onClick={() => void retryMfaCheck()}
                  disabled={mfaBusy}
                >
                  {mfaBusy ? "Checking…" : "Retry security check"}
                </button>
              </>
            )}

            {msg && (
              <div className="mt-3 text-sm text-muted-foreground">{msg}</div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => void forceSignedOut()}
                disabled={mfaBusy}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : !session && accessRequestSubmitted ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-background p-6 text-foreground shadow-xl">
            <div className="mb-4 text-lg font-semibold">LifeSwitch</div>
            <div
              className="rounded-2xl border bg-muted/30 px-5 py-6 text-center"
              role="status"
            >
              <div
                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700"
                aria-hidden="true"
              >
                ✓
              </div>
              <h2 className="text-lg font-semibold">Request received</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your request was sent to the LifeSwitch owner for review. If it
                is approved, an invitation will be sent by email. Delivery may
                take a few minutes.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                You may close this page.
              </p>
              <button
                type="button"
                className="mt-5 w-full rounded-xl bg-muted px-3 py-2 hover:bg-muted/60"
                onClick={() => {
                  setMode("login");
                  setAccessRequestSubmitted(false);
                }}
              >
                Return to log in
              </button>
            </div>
          </div>
        </div>
      ) : !session ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-background p-6 text-foreground shadow-xl">
            <div className="mb-4 text-lg font-semibold">LifeSwitch</div>

            <div className="mb-4 flex gap-2 text-sm">
              <button
                className={`rounded-lg px-3 py-1 ${mode === "login" ? "bg-muted" : "bg-transparent hover:bg-muted/60"}`}
                onClick={() => {
                  setMode("login");
                  setLoginToken("");
                  setAccessRequestToken("");
                  setMsg("");
                }}
                disabled={busy}
              >
                Log in
              </button>
              <button
                className={`rounded-lg px-3 py-1 ${mode === "request" ? "bg-muted" : "bg-transparent hover:bg-muted/60"}`}
                onClick={() => {
                  setMode("request");
                  setLoginToken("");
                  setAccessRequestToken("");
                  setMsg("");
                }}
                disabled={busy}
              >
                Request access
              </button>
            </div>

            {mode === "request" && (
              <input
                className="mb-2 w-full rounded-xl border bg-background px-3 py-2"
                placeholder="Full name (optional)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={busy}
              />
            )}

            <input
              className="mb-2 w-full rounded-xl border bg-background px-3 py-2"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />

            {mode === "login" ? (
              <>
                <input
                  className="mb-3 w-full rounded-xl border bg-background px-3 py-2"
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
            ) : (
              <>
                <textarea
                  className="mb-3 min-h-24 w-full resize-y rounded-xl border bg-background px-3 py-2"
                  placeholder="How would you like to use LifeSwitch? (optional)"
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  maxLength={1000}
                  disabled={busy}
                />
                <TurnstileWidget
                  ref={accessRequestTurnstileRef}
                  action="request_access"
                  onToken={setAccessRequestToken}
                />
              </>
            )}

            <button
              className="w-full rounded-xl bg-muted px-3 py-2 hover:bg-muted/60 disabled:opacity-50"
              onClick={mode === "login" ? handleLogin : handleAccessRequest}
              disabled={
                busy ||
                (mode === "login" && !loginToken) ||
                (mode === "request" && !accessRequestToken)
              }
            >
              {busy
                ? "Working…"
                : mode === "login"
                  ? "Log in"
                  : "Request access"}
            </button>

            {msg && (
              <div className="mt-3 text-sm text-muted-foreground">{msg}</div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={forceSignedOut}
                disabled={busy}
              >
                Clear session
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
