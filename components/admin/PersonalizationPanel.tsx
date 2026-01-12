"use client";

import * as React from "react";

type Theme = "dark" | "light" | "dark-hc";

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
  root.classList.toggle("dark", t === "dark" || t === "dark-hc");
  root.classList.toggle("dark-hc", t === "dark-hc");
  lsSet("vs_theme", t);
}

export function PersonalizationPanel() {
  const [theme, setTheme] = React.useState<Theme>("dark");

  React.useEffect(() => {
    const t = lsGet<Theme>("vs_theme", "dark");
    setTheme(t);
    applyTheme(t);
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
          }}
        >
          <option value="dark">Dark</option>
          <option value="dark-hc">Dark (high contrast)</option>
          <option value="light">Light</option>
        </select>

        <div className="text-xs text-muted-foreground">
          Stored locally in this browser (<code>localStorage</code>, key <code>vs_theme</code>).
        </div>
      </div>
    </div>
  );
}
