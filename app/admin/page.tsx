"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { AdminConsolePage } from "@/components/admin/settings/AdminConsolePage";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const role = (data.user as any)?.app_metadata?.role;
        if (alive) setIsAdmin(role === "admin");
      } catch {
        if (alive) setIsAdmin(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (isAdmin === null) {
    return (
      <SettingsPageFrame title="Admin Console" description="Administrative controls.">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </SettingsPageFrame>
    );
  }

  if (!isAdmin) {
    return (
      <SettingsPageFrame title="Admin Console" description="Administrative controls.">
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          This area is restricted to admin accounts.
        </div>
      </SettingsPageFrame>
    );
  }

  return (
    <SettingsPageFrame
      title="Admin Console"
      description="Inspect and manage administrative Verbal Sage systems."
    >
      <AdminConsolePage />
    </SettingsPageFrame>
  );
}
