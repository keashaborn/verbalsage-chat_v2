"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";

const MAX_AGE_S = 60 * 60 * 24 * 30;
const CLOUD_KEY = "vs_settings_v1";

type CloudSettingsV1 = {
  updated_at?: string;
  model?: string | null;
  [key: string]: unknown;
};

async function pushCloudModel(model: string) {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return;

    const metadata: Record<string, unknown> = data.user.user_metadata || {};
    const previous = (metadata[CLOUD_KEY] || {}) as CloudSettingsV1;
    const next: CloudSettingsV1 = {
      ...previous,
      updated_at: new Date().toISOString(),
      model,
    };

    // Preserve all other metadata, including inert historical fields.
    await supabase.auth.updateUser({
      data: { ...metadata, [CLOUD_KEY]: next },
    });
  } catch {
    // Cloud synchronization is best effort and must not block local settings.
  }
}

export type VSSettingsState = {
  theme: string | null;
  model: string | null;
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
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeStringCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(String(value))}; Max-Age=${MAX_AGE_S}; path=/; SameSite=Lax`;
}

function loadPersisted(): VSSettingsState {
  return {
    theme: safeLocalStorageGet("vs_theme"),
    model: readCookie("vs_model"),
  };
}

export type SettingsStore = {
  applied: VSSettingsState;
  draft: VSSettingsState;
  applyModelNow: (rawModel: string) => void;
};

const SettingsStoreContext = React.createContext<SettingsStore | null>(null);

export function SettingsStoreProvider({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const [applied, setApplied] = React.useState<VSSettingsState>(() =>
    loadPersisted(),
  );
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
      setApplied((previous) =>
        previous.theme === theme ? previous : { ...previous, theme },
      );
      setDraft((previous) =>
        previous.theme === theme ? previous : { ...previous, theme },
      );
    };

    syncTheme();
    const onTheme = () => syncTheme();
    const onStorage = (event: StorageEvent) => {
      if (event.key === "vs_theme") syncTheme();
    };

    window.addEventListener("vs_theme_changed", onTheme);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("vs_theme_changed", onTheme);
      window.removeEventListener("storage", onStorage);
    };
  }, [open]);

  const applyModelNow = React.useCallback((rawModel: string) => {
    const model = String(rawModel || "")
      .trim()
      .slice(0, 64);
    if (!model) return;

    writeStringCookie("vs_model", model);
    setApplied((previous) => ({ ...previous, model }));
    setDraft((previous) => ({ ...previous, model }));
    void pushCloudModel(model);
  }, []);

  const value = React.useMemo(
    () => ({ applied, draft, applyModelNow }),
    [applied, draft, applyModelNow],
  );

  return (
    <SettingsStoreContext.Provider value={value}>
      {children}
    </SettingsStoreContext.Provider>
  );
}

export function useSettingsStore() {
  const context = React.useContext(SettingsStoreContext);
  if (!context) {
    throw new Error(
      "useSettingsStore must be used within SettingsStoreProvider",
    );
  }
  return context;
}
