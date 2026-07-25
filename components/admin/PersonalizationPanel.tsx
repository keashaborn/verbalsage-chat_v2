"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { applyTheme, normalizeThemeValue, readStoredTheme, type VSTheme } from "@/lib/theme";

function saveThemeCloud(t: VSTheme) {
  void supabase.auth.updateUser({
    data: { vs_theme: t },
  });
}

export function PersonalizationPanel() {
  const [theme, setTheme] = React.useState<VSTheme>("graphite");

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
    <div className="mb-4 rounded-xl border p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Theme</div>

      <div className="mt-3 space-y-2">
        <select
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
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
          Graphite is the default. Slate and Mist add subtle cool alternatives; Paper remains softly neutral. Your choice syncs to your account.
        </div>
      </div>
    </div>
  );
}
