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
    <section className="space-y-3">
      <div className="text-sm font-semibold">Theme</div>

      <div className="space-y-2">
        <select
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          value={theme}
          onChange={(e) => {
            const t = e.target.value as VSTheme;
            setTheme(t);
            applyTheme(t);
            saveThemeCloud(t);
          }}
        >
          <option value="graphite">Graphite</option>
          <option value="slate">Slate</option>
          <option value="mist">Mist</option>
          <option value="paper">Paper</option>
        </select>

        <div className="text-xs text-muted-foreground">
          Applies across LifeSwitch and Verbal Sage and syncs to your account.
        </div>
      </div>
    </section>
  );
}
