"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  applyTheme,
  DEFAULT_THEME,
  normalizeThemeValue,
  readStoredTheme,
  type VSTheme,
} from "@/lib/theme";

function saveThemeCloud(t: VSTheme) {
  void supabase.auth.updateUser({
    data: { vs_theme: t },
  });
}

export function PersonalizationPanel() {
  const [theme, setTheme] = React.useState<VSTheme>(DEFAULT_THEME);

  React.useEffect(() => {
    let cancelled = false;

    const localTheme = readStoredTheme();
    setTheme(localTheme);
    applyTheme(localTheme);

    void (async () => {
      const { data } = await supabase.auth.getUser();
      const md: any = data?.user?.user_metadata || {};
      const cloudTheme = normalizeThemeValue(md?.vs_theme);

      if (cancelled || !cloudTheme) return;

      setTheme(cloudTheme);
      applyTheme(cloudTheme);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Theme</span>
        <select
          className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={theme}
          onChange={(e) => {
            const t = e.target.value as VSTheme;
            setTheme(t);
            applyTheme(t);
            saveThemeCloud(t);
          }}
        >
          <option value="balanced">Balanced</option>
          <option value="mist">Light</option>
          <option value="slate">Dark</option>
        </select>
      </label>
    </section>
  );
}
