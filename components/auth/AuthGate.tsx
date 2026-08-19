"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/auth/TurnstileWidget";
import {
  PublicAuthNotice,
  PUBLIC_AUTH_PRIMARY_ACTION_CLASS,
} from "@/components/auth/PublicAuthShell";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";
import { applyTheme, DEFAULT_THEME, normalizeThemeValue } from "@/lib/theme";
import { storeConversationStyle } from "@/lib/conversationStyle";
import { normalizeSpeechVoice, storeSpeechVoice } from "@/lib/speechSettings";
import {
  VOICE_PRIVACY_NOTICE_STORAGE_KEY,
  VOICE_PRIVACY_NOTICE_VERSION,
} from "@/lib/voicePrivacy";
import { useSiteBrand } from "@/components/site/SiteBrandProvider";

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
  const { brand } = useSiteBrand();
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

  async function syncConversationStyleBestEffort() {
    try {
      const response = await withTimeout(
        authFetch("/api/user/assistant-preferences", {
          cache: "no-store",
        }),
        2500,
        "assistant-preferences.sync",
      );
      if (!response.ok) return;
      const value = await response.json();
      storeConversationStyle(value?.conversation_style);
    } catch {
      // The browser cache is delivery-only. A temporary sync failure must not
      // block authentication or create a second account-level authority.
    }
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
    void syncConversationStyleBestEffort();
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 p-4 supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur-xl">
          <div className="w-full max-w-md rounded-xl border bg-card/95 p-6 text-foreground shadow-lg">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {brand.name} protected account
            </div>
            <h1 className="mt-2 text-xl font-semibold">
              Multi-factor verification
            </h1>

            {mfaGate === "required" ? (
              <>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Enter the current 6-digit code from your authenticator app
                  before opening {brand.name}.
                </p>

                {mfaFactors.length > 1 && (
                  <label className="mt-4 grid gap-1 text-sm">
                    <span>Authenticator</span>
                    <select
                      className="min-h-11 w-full rounded-lg border bg-background px-3 py-2"
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
                    className="min-h-11 w-full rounded-lg border bg-background px-3 py-2 font-mono tracking-[0.2em]"
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
                  className={`${PUBLIC_AUTH_PRIMARY_ACTION_CLASS} mt-4 w-full`}
                  onClick={() => void verifyMfaCode()}
                  disabled={mfaBusy || mfaCode.length !== 6}
                >
                  {mfaBusy ? "Verifying…" : "Verify and continue"}
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {brand.name} could not confirm the multi-factor status of this
                  protected account. The application remains locked.
                </p>
                <button
                  type="button"
                  className={`${PUBLIC_AUTH_PRIMARY_ACTION_CLASS} mt-4 w-full`}
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 p-4 supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur-xl">
          <div className="w-full max-w-md rounded-xl border bg-card/95 p-6 text-foreground shadow-lg">
            <div className="product-brand-text mb-4 text-lg font-semibold">
              {brand.name}
            </div>
            <div
              className="border-t border-border/70 pt-5 text-center"
              role="status"
            >
              <div
                className="mb-3 text-lg font-semibold text-emerald-600"
                aria-hidden="true"
              >
                ✓
              </div>
              <h2 className="text-lg font-semibold">Request received</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your request was sent to the {brand.name} owner for review. If
                it is approved, an invitation will be sent by email. Delivery
                may take a few minutes.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                You may close this page.
              </p>
              <button
                type="button"
                className={`${PUBLIC_AUTH_PRIMARY_ACTION_CLASS} mt-5 w-full`}
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 p-4 supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur-xl">
          <div className="w-full max-w-md rounded-xl border bg-card/95 p-6 text-foreground shadow-lg">
            <div className="product-brand-text mb-4 text-lg font-semibold">
              {brand.name}
            </div>

            <div
              className="mb-4 flex border-b border-border/70"
              role="tablist"
              aria-label={`${brand.name} access`}
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
                  setMsg("");
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
                  setMsg("");
                }}
                disabled={busy}
              >
                Request access
              </button>
            </div>

            {mode === "request" && (
              <label className="mb-3 grid gap-1.5 text-sm">
                <span>
                  Full name{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </span>
                <input
                  className="min-h-11 w-full rounded-lg border bg-background px-3 py-2"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  disabled={busy}
                />
              </label>
            )}

            <label className="mb-3 grid gap-1.5 text-sm">
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
                <label className="mb-3 grid gap-1.5 text-sm">
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
              <>
                <label className="mb-3 grid gap-1.5 text-sm">
                  <span>
                    How would you like to use {brand.name}?{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </span>
                  <textarea
                    className="min-h-24 w-full resize-y rounded-lg border bg-background px-3 py-2"
                    value={requestMessage}
                    onChange={(event) => setRequestMessage(event.target.value)}
                    maxLength={1000}
                    disabled={busy}
                  />
                </label>
                <TurnstileWidget
                  ref={accessRequestTurnstileRef}
                  action="request_access"
                  onToken={setAccessRequestToken}
                />
              </>
            )}

            <button
              type="button"
              className={`${PUBLIC_AUTH_PRIMARY_ACTION_CLASS} w-full`}
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

            {msg ? (
              <div className="mt-3">
                <PublicAuthNotice>{msg}</PublicAuthNotice>
              </div>
            ) : null}

            <details className="mt-4 text-xs text-muted-foreground">
              <summary className="w-fit cursor-pointer hover:text-foreground">
                Sign-in help
              </summary>
              <p className="mt-2 leading-5">
                If sign-in is stuck after an account change, reset the saved
                sign-in session and try again.
              </p>
              <button
                type="button"
                className="mt-2 min-h-11 text-left font-medium text-foreground hover:underline"
                onClick={forceSignedOut}
                disabled={busy}
              >
                Reset saved sign-in session
              </button>
            </details>
          </div>
        </div>
      ) : null}
    </>
  );
}
