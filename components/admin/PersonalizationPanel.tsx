"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";

type Theme = "paper" | "light" | "dark" | "graphite" | "carbon" | "dark-hc";

function isTheme(v: any): v is Theme {
  return v === "paper" || v === "light" || v === "dark" || v === "graphite" || v === "carbon" || v === "dark-hc";
}

function lsGet<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    if (v == null) return fallback;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function lsSet(k: string, v: any) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // ignore
  }
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark" || t === "dark-hc" || t === "graphite" || t === "carbon");
  root.classList.toggle("dark-hc", t === "dark-hc");
  root.classList.toggle("paper", t === "paper");
  root.classList.toggle("graphite", t === "graphite");
  root.classList.toggle("carbon", t === "carbon");
  lsSet("vs_theme", t);

  try {
    window.dispatchEvent(new Event("vs_theme_changed"));
  } catch {
    // ignore
  }
}

function saveThemeCloud(t: Theme) {
  void supabase.auth.updateUser({
    data: { vs_theme: t },
  });
}

export function PersonalizationPanel() {
  const [theme, setTheme] = React.useState<Theme>("dark");

  React.useEffect(() => {
    let cancelled = false;

    const local = lsGet<Theme>("vs_theme", "graphite");
    const localTheme = isTheme(local) ? local : "dark";
    setTheme(localTheme);
    applyTheme(localTheme);

    void (async () => {
      const { data } = await supabase.auth.getUser();
      const md: any = data?.user?.user_metadata || {};
      const cloudTheme = md?.vs_theme;

      if (cancelled || !isTheme(cloudTheme)) return;

      setTheme(cloudTheme);
      applyTheme(cloudTheme);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mb-4 rounded-xl border p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Theme</div>

      <div className="mt-3 space-y-2">
        <select
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          value={theme}
          onChange={(e) => {
            const t = e.target.value as Theme;
            setTheme(t);
            applyTheme(t);
            saveThemeCloud(t);
          }}
        >
          <option value="paper">Paper</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="graphite">Graphite</option>
          <option value="carbon">Carbon</option>
          <option value="dark-hc">Dark (high contrast)</option>
        </select>

        <div className="text-xs text-muted-foreground">
          Synced to your account and cached in this browser.
        </div>
      </div>
    </div>
  );
}
