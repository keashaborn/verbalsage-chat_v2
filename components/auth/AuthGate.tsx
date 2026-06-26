"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";

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


function applyThemeFromMetadata(md: any) {
  const t = String(md?.vs_theme || "").trim();
  if (!(t === "dark" || t === "light" || t === "dark-hc")) return;

  lsSet("vs_theme", JSON.stringify(t));

  try {
    document.documentElement.classList.toggle("dark", t === "dark" || t === "dark-hc");
    document.documentElement.classList.toggle("dark-hc", t === "dark-hc");
    window.dispatchEvent(new Event("vs_theme_changed"));
  } catch {
    // ignore
  }
}

function applyProfileCookiesFromSession(session: any): boolean {
  // Apply from session.user.user_metadata.vs_settings_v1 (no extra network call).
  try {
    const md: any = session?.user?.user_metadata || {};
    applyThemeFromMetadata(md);

    const v1: any = session?.user?.user_metadata?.vs_settings_v1;
    if (!v1) return false;

    const cloudUpdatedAt = String(v1.updated_at || "");
    const localUpdatedAt = lsGet(LS_CLOUD_UPDATED_AT) || "";

    const needApply = !hasProfileCookies() || (cloudUpdatedAt && cloudUpdatedAt !== localUpdatedAt);
    if (!needApply) return true;

    if (v1.model) {
      writeStringCookie("vs_model", String(v1.model).trim().slice(0, 64));
    }
    if (md.vs_voice_engine === "openai_tts" || md.vs_voice_engine === "grok_realtime") {
      lsSet("vs_voice_engine", md.vs_voice_engine);
    }

    if (typeof md.vs_voice === "string" && md.vs_voice.trim()) {
      lsSet("vs_voice", JSON.stringify(md.vs_voice.trim()));
    }

    if (typeof md.vs_voice_model === "string" && md.vs_voice_model.trim()) {
      lsSet("vs_voice_model", JSON.stringify(md.vs_voice_model.trim()));
    }

    if (md.vs_voice_speed != null && Number.isFinite(Number(md.vs_voice_speed))) {
      lsSet("vs_voice_speed", JSON.stringify(Number(md.vs_voice_speed)));
    }

    if (typeof md.vs_grok_voice === "string" && md.vs_grok_voice.trim()) {
      lsSet("vs_grok_voice", JSON.stringify(md.vs_grok_voice.trim()));
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

      if (active.pragmatics == null) clearCookie("vs_vantage_pragmatics");
      else writeJsonCookie("vs_vantage_pragmatics", active.pragmatics);

      if (active.roleplay == null) {
        clearCookie("vs_vantage_definition_overlay");
        clearCookie("vs_vantage_roleplay");
      } else {
        writeJsonCookie("vs_vantage_definition_overlay", active.roleplay);
        writeJsonCookie("vs_vantage_roleplay", active.roleplay);
      }
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
      "identity.sync"
    );
  }

  async function applyDefaultProfileBestEffort() {
    if (hasProfileCookies()) return;
    await withTimeout(
      authFetch("/api/profiles/apply_default", { method: "POST" }),
      2500,
      "profiles.apply_default"
    );
  }

  async function bootstrapFromSession(s: any | null) {
    setMsg("");

    // Signed out path
    if (!s) {
      setSession(null);
      return;
    }

    // Supabase session is the source of truth. API calls attach the bearer token via authFetch.
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

  // Do not mount the app until the Supabase session is valid.
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
