"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

const MAX_AGE_S = 60 * 60 * 24 * 30; // 30d
const LS_CLOUD_UPDATED_AT = "vs_cloud_settings_v1_updated_at";

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

function hasProfileCookies(): boolean {
  if (typeof document === "undefined") return false;
  const c = document.cookie || "";
  // Keep this intentionally loose; mix/routing/limits can be empty by design.
  return c.includes("vs_vantage_id=");
}

function writeCookieRaw(name: string, rawValue: string) {
  document.cookie = `${name}=${rawValue}; Max-Age=${MAX_AGE_S}; path=/; SameSite=Lax`;
}
function writeStringCookie(name: string, value: string) {
  writeCookieRaw(name, encodeURIComponent(String(value)));
}
function writeJsonCookie(name: string, obj: any) {
  writeCookieRaw(name, encodeURIComponent(JSON.stringify(obj)));
}
function clearCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: any;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(t)), timeout]);
}

async function fetchOk(url: string, init: RequestInit, ms: number): Promise<boolean> {
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

function applyProfileCookiesFromSession(session: any): boolean {
  // Apply from session.user.user_metadata.vs_settings_v1 (no extra network call).
  try {
    const v1: any = session?.user?.user_metadata?.vs_settings_v1;
    if (!v1) return false;

    const cloudUpdatedAt = String(v1.updated_at || "");
    const localUpdatedAt = lsGet(LS_CLOUD_UPDATED_AT) || "";

    const needApply = !hasProfileCookies() || (cloudUpdatedAt && cloudUpdatedAt !== localUpdatedAt);
    if (!needApply) return true;

    if (v1.model) {
      writeStringCookie("vs_model", String(v1.model).trim().slice(0, 64));
    }

    const active = v1?.vantage?.active;
    if (active) {
      const vid = String(active.vantageId || "default").trim().slice(0, 64) || "default";
      writeStringCookie("vs_vantage_id", vid);

      if (active.mix == null) clearCookie("vs_vantage_mix");
      else writeJsonCookie("vs_vantage_mix", active.mix);

      if (active.routing == null) clearCookie("vs_vantage_routing");
      else writeJsonCookie("vs_vantage_routing", active.routing);

      if (active.limits == null) clearCookie("vs_vantage_limits");
      else writeJsonCookie("vs_vantage_limits", active.limits);
    }

    if (cloudUpdatedAt) lsSet(LS_CLOUD_UPDATED_AT, cloudUpdatedAt);
    return true;
  } catch {
    return false;
  }
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<any>(null);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function syncServerAuthCookies(s: any | null): Promise<boolean> {
    if (s?.access_token && s?.user?.id) {
      return await fetchOk(
        "/api/auth/set",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: s.access_token,
            refresh_token: s.refresh_token,
            expires_at: s.expires_at,
          }),
        },
        2500
      );
    } else {
      // Always best-effort clear.
      await fetchOk("/api/auth/logout", { method: "POST" }, 2500);
      return true;
    }
  }

  async function syncIdentityBestEffort(s: any) {
    const u = s?.user;
    if (!u?.id) return;

    const full_name = String(u?.user_metadata?.full_name || "").trim();
    const email = String(u?.email || "").trim();

    await fetchOk(
      "/api/identity",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name, email }),
      },
      2500
    );
  }

  async function applyDefaultProfileBestEffort() {
    if (hasProfileCookies()) return;
    await fetchOk("/api/profiles/apply_default", { method: "POST" }, 2500);
  }

  async function bootstrapFromSession(s: any | null) {
    setMsg("");

    // Signed out path
    if (!s) {
      await syncServerAuthCookies(null);
      setSession(null);
      return;
    }

    // Ensure vs_at exists before mounting the app (prevents /api/* 401 race).
    const ok = await syncServerAuthCookies(s);
    if (!ok) {
      setSession(null);
      setMsg("Auth cookie sync failed (/api/auth/set). Refresh and try again.");
      return;
    }

    // Now we are safe to mount the app.
    setSession(s);

    // Best-effort, non-blocking extras.
    applyProfileCookiesFromSession(s);
    void applyDefaultProfileBestEffort();
    void syncIdentityBestEffort(s);
  }

  async function forceSignedOut() {
    try {
      await withTimeout(supabase.auth.signOut(), 4000, "supabase.signOut");
    } catch {}
    await syncServerAuthCookies(null);
    setSession(null);
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
        const { data, error } = await withTimeout(supabase.auth.getSession(), 4000, "supabase.getSession");

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
        else setMsg("Auth bootstrap timed out. Refresh once; if it repeats, clear site data.");
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
    setBusy(true);
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        8000,
        "supabase.signInWithPassword"
      );
      if (error) setMsg(error.message);
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup() {
    setMsg("");
    setBusy(true);
    try {
      const { error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName || null } },
        }),
        8000,
        "supabase.signUp"
      );
      if (error) setMsg(error.message);
      else setMsg("Check your email to confirm (if required), then log in.");
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  if (booting) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Do NOT mount the app until session is valid + vs_at cookie is synced.
  // This prevents “missing chats until refresh” caused by early unauthenticated fetches.
  const showApp = !!session;

  return (
    <>
      {showApp ? children : null}

      {!session && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-background p-6 text-foreground shadow-xl">
            <div className="mb-4 text-lg font-semibold">Verbal Sage</div>

            <div className="mb-4 flex gap-2 text-sm">
              <button
                className={`rounded-lg px-3 py-1 ${mode === "login" ? "bg-muted" : "bg-transparent hover:bg-muted/60"}`}
                onClick={() => setMode("login")}
                disabled={busy}
              >
                Log in
              </button>
              <button
                className={`rounded-lg px-3 py-1 ${mode === "signup" ? "bg-muted" : "bg-transparent hover:bg-muted/60"}`}
                onClick={() => setMode("signup")}
                disabled={busy}
              >
                Sign up
              </button>
            </div>

            {mode === "signup" && (
              <input
                className="mb-2 w-full rounded-xl border bg-background px-3 py-2"
                placeholder="Full name"
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

            <input
              className="mb-3 w-full rounded-xl border bg-background px-3 py-2"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />

            <button
              className="w-full rounded-xl bg-muted px-3 py-2 hover:bg-muted/60 disabled:opacity-50"
              onClick={mode === "login" ? handleLogin : handleSignup}
              disabled={busy}
            >
              {busy ? "Working…" : mode === "login" ? "Log in" : "Create account"}
            </button>

            {msg && <div className="mt-3 text-sm text-muted-foreground">{msg}</div>}

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
      )}
    </>
  );
}
