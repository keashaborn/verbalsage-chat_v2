"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";

const MAX_AGE_S = 60 * 60 * 24 * 30; // 30d
const CLOUD_KEY = "vs_settings_v1";

type CloudSettingsV1 = {
  updated_at?: string;
  model?: string | null;
  vantage?: {
    active?: {
      vantageId: string;
      mix: any | null;
      routing: any | null;
      limits: any | null;
      pragmatics: any | null; // cookie: vs_vantage_pragmatics (JSON)
      roleplay: any | null; // cookie: vs_vantage_roleplay (JSON)
    };
  };
};

async function pushCloudActiveProfile(args: {
  model: string | null;
  vantageId: string;
  mix: any | null;
  routing: any | null;
  limits: any | null;
  pragmatics: any | null;
  roleplay: any | null;
}) {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return;

    const um: any = data.user.user_metadata || {};
    const prev: CloudSettingsV1 = (um[CLOUD_KEY] || {}) as any;

    const next: CloudSettingsV1 = {
      ...prev,
      updated_at: new Date().toISOString(),
      model: args.model ?? prev.model ?? null,
      vantage: {
        ...(prev.vantage || {}),
        active: {
          vantageId: normalizeVantageId(args.vantageId),
          mix: args.mix ?? null,
          routing: args.routing ?? null,
          limits: args.limits ?? null,
          pragmatics: args.pragmatics ?? null,
          roleplay: args.roleplay ?? null,
        },
      },
    };

    // Keep other user_metadata keys intact (full_name, etc.)
    await supabase.auth.updateUser({ data: { ...um, [CLOUD_KEY]: next } });
  } catch {
    // ignore (no crash)
  }
}

export type VSSettingsState = {
  // These may be shown in the UI, but (for now) Save only commits Vantage cookies.
  theme: string | null; // localStorage: vs_theme (not saved by global Save yet)
  model: string | null; // cookie: vs_model (applies immediately)

  // Mode / Vantage profile (draft-only until Save)
  vantageId: string | null; // cookie: vs_vantage_id
  mix: any | null; // cookie: vs_vantage_mix (JSON)
  routing: any | null; // cookie: vs_vantage_routing (JSON)
  limits: any | null; // cookie: vs_vantage_limits (JSON)
  pragmatics: any | null; // cookie: vs_vantage_pragmatics (JSON)
  roleplay: any | null; // cookie: vs_vantage_roleplay (JSON)

};

const DEFAULT_STATE: VSSettingsState = {
  theme: null,
  model: null,

  // Default baseline for new browsers / cleared cookies:
  // Use RESSE as the "factory" vantage.
  vantageId: "RESSE",
  mix: {
    conversation: 0.6,
    memory_cards: 0.7,
    corpus: 0.8,
    lens_fm: 0.8,
    recency_bias: 0.6,
    similarity_threshold: 0.4,
  },
  routing: {
    answer_first: true,
    clarify_bias: 0.1,
    max_clarify_questions: 1,
  },
  limits: {
    Y: 0.1,
    R: 0.2,
    C: 0.4,
    S: 0.4,
  },
  pragmatics: {
    rfg: 0.0,
    df: 0.7,
    pe: 2,
  },
  roleplay: null,

};

function safeLocalStorageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookieRaw(name: string, rawValue: string, maxAgeS = MAX_AGE_S) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${rawValue}; Max-Age=${maxAgeS}; path=/; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
}

function readJsonCookie(name: string): any | null {
  const raw = readCookie(name);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStringCookie(name: string, value: string) {
  writeCookieRaw(name, encodeURIComponent(String(value)));
}

function writeJsonCookie(name: string, obj: any) {
  writeCookieRaw(name, encodeURIComponent(JSON.stringify(obj)));
}

function normalizeVantageId(v: any): string {
  const raw = String(v ?? "").trim().slice(0, 64);
  if (!raw) return "RESSE";
  const t = raw.toLowerCase();
  if (t === "default") return "RESSE";
  return raw.toUpperCase();
}

function loadPersisted(): VSSettingsState {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };

  const theme = safeLocalStorageGet("vs_theme"); // display only for now
  const model = readCookie("vs_model");

  const cookieVidRaw = readCookie("vs_vantage_id");
  const vantageId = cookieVidRaw ? normalizeVantageId(cookieVidRaw) : DEFAULT_STATE.vantageId;

  const mix = readJsonCookie("vs_vantage_mix") ?? DEFAULT_STATE.mix;
  const routing = readJsonCookie("vs_vantage_routing") ?? DEFAULT_STATE.routing;
  const limits = readJsonCookie("vs_vantage_limits") ?? DEFAULT_STATE.limits;
  const pragmatics = readJsonCookie("vs_vantage_pragmatics") ?? DEFAULT_STATE.pragmatics;

  const roleplay =
    (readJsonCookie("vs_vantage_definition_overlay") ?? readJsonCookie("vs_vantage_roleplay")) ??
    DEFAULT_STATE.roleplay;

  return { theme, model, vantageId, mix, routing, limits, pragmatics, roleplay };
}

// For now, global Save commits ONLY the Vantage cookies to avoid clobbering
// other settings that still persist immediately (theme/model/etc).
function persistVantageCookies(draft: VSSettingsState) {
  const vid = normalizeVantageId(draft.vantageId);

  writeStringCookie("vs_vantage_id", vid);

  if (draft.mix == null) clearCookie("vs_vantage_mix");
  else writeJsonCookie("vs_vantage_mix", draft.mix);

  if (draft.routing == null) clearCookie("vs_vantage_routing");
  else writeJsonCookie("vs_vantage_routing", draft.routing);

  if (draft.limits == null) clearCookie("vs_vantage_limits");
  else writeJsonCookie("vs_vantage_limits", draft.limits);

  if (draft.pragmatics == null) clearCookie("vs_vantage_pragmatics");
  else writeJsonCookie("vs_vantage_pragmatics", draft.pragmatics);
  if (draft.roleplay == null) {
    clearCookie("vs_vantage_definition_overlay");
    clearCookie("vs_vantage_roleplay");
  } else {
    // Write both names for compatibility while the UI/backend migrates from
    // "roleplay" terminology to "definition overlay".
    writeJsonCookie("vs_vantage_definition_overlay", draft.roleplay);
    writeJsonCookie("vs_vantage_roleplay", draft.roleplay);
  }
  return { vid };
}

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function persistedProjection(s: VSSettingsState) {
  // Only Vantage is draft-only + saved via "Save Vantage".
  // Model/voice/theme apply immediately and must NOT affect dirty.
  return {
    vantageId: normalizeVantageId(s.vantageId),
    mix: s.mix,
    routing: s.routing,
    limits: s.limits,
    pragmatics: s.pragmatics,
    roleplay: s.roleplay,
  };
}

export type SettingsStore = {
  applied: VSSettingsState;
  draft: VSSettingsState;
  setDraft: React.Dispatch<React.SetStateAction<VSSettingsState>>;
  dirty: boolean;

  // Apply chat model immediately (writes cookie + updates state + best-effort cloud sync).
  applyModelNow: (rawModel: string) => void;

  save: () => void;
  revert: () => void;
  reload: () => void;
};

const SettingsStoreContext = React.createContext<SettingsStore | null>(null);

export function SettingsStoreProvider({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const [applied, setApplied] = React.useState<VSSettingsState>(() => loadPersisted());
  const [draft, setDraft] = React.useState<VSSettingsState>(() => applied);

  React.useEffect(() => {
    if (!open) return;
    const next = loadPersisted();
    setApplied(next);
    setDraft(next);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const syncTheme = () => {
      const theme = safeLocalStorageGet("vs_theme");
      setApplied((prev) => (prev.theme === theme ? prev : { ...prev, theme }));
      setDraft((prev) => (prev.theme === theme ? prev : { ...prev, theme }));
    };

    syncTheme();

    const onTheme = () => syncTheme();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "vs_theme") syncTheme();
    };

    window.addEventListener("vs_theme_changed", onTheme);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("vs_theme_changed", onTheme);
      window.removeEventListener("storage", onStorage);
    };
  }, [open]);


  const dirty = React.useMemo(() => {
    return !deepEqual(persistedProjection(applied), persistedProjection(draft));
  }, [applied, draft]);

  const applyModelNow = React.useCallback(
    (raw: string) => {
      const next = String(raw || "").trim().slice(0, 64);
      if (!next) return;

      // Persist immediately so /api/chat picks it up on next message.
      writeStringCookie("vs_model", next);

      // Update local UI state immediately.
      setApplied((prev) => ({ ...prev, model: next }));
      setDraft((prev) => ({ ...prev, model: next }));

      // Sync to cloud using APPLIED Vantage settings only (avoid leaking unsaved draft changes).
      void pushCloudActiveProfile({
        model: next,
        vantageId: normalizeVantageId(applied.vantageId),
        mix: applied.mix,
        routing: applied.routing,
        limits: applied.limits,
        pragmatics: applied.pragmatics,
        roleplay: applied.roleplay,
      });
    },
    [applied.vantageId, applied.mix, applied.routing, applied.limits, applied.pragmatics, applied.roleplay]
  );

  const save = React.useCallback(() => {
    const { vid } = persistVantageCookies(draft);


    // Push to Supabase so other devices can hydrate
    const modelNow = readCookie("vs_model"); // always read latest cookie
    void pushCloudActiveProfile({
      model: modelNow,
      vantageId: vid,
      mix: draft.mix,
      routing: draft.routing,
      limits: draft.limits,
      pragmatics: draft.pragmatics,
      roleplay: draft.roleplay,
    });

    // Only update the parts we actually persisted (Vantage fields only).
    setApplied((prev) => ({
      ...prev,
      vantageId: vid,
      mix: draft.mix,
      routing: draft.routing,
      limits: draft.limits,
      pragmatics: draft.pragmatics,
      roleplay: draft.roleplay,
    }));

    setDraft((prev) => ({
      ...prev,
      vantageId: vid,
      mix: draft.mix,
      routing: draft.routing,
      limits: draft.limits,
      pragmatics: draft.pragmatics,
      roleplay: draft.roleplay,
    }));
  }, [draft]);

  const revert = React.useCallback(() => {
    setDraft(applied);
  }, [applied]);

  // NOTE: This resets draft; do not call it from inside pages while editing.
  const reload = React.useCallback(() => {
    const next = loadPersisted();
    setApplied(next);
    setDraft(next);
  }, []);

  const value = React.useMemo(
    () => ({ applied, draft, setDraft, dirty, applyModelNow, save, revert, reload }),
    [applied, draft, dirty, applyModelNow, save, revert, reload]
  );

  return <SettingsStoreContext.Provider value={value}>{children}</SettingsStoreContext.Provider>;
}

export function useSettingsStore() {
  const ctx = React.useContext(SettingsStoreContext);
  if (!ctx) throw new Error("useSettingsStore must be used within SettingsStoreProvider");
  return ctx;
}
