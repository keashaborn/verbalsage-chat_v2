"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";
import { AdminConsolePage } from "@/components/admin/settings/AdminConsolePage";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

type AdminAccess = {
  ok: true;
  user_id: string;
  role: "owner" | "admin";
  role_label: "Owner" | "Admin";
};

export default function AdminPage() {
  const [access, setAccess] = React.useState<AdminAccess | null | undefined>(
    undefined,
  );

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const response = await authFetch("/api/admin/access", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response
          .json()
          .catch(() => null)) as AdminAccess | null;
        if (alive) {
          setAccess(response.ok && payload?.ok ? payload : null);
        }
      } catch {
        if (alive) setAccess(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (access === undefined) {
    return (
      <SettingsPageFrame
        title="Admin Console"
        description="Administrative controls."
      >
        <div className="text-sm text-muted-foreground">Loading…</div>
      </SettingsPageFrame>
    );
  }

  if (!access) {
    return (
      <SettingsPageFrame
        title="Admin Console"
        description="Administrative controls."
      >
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          This area is restricted to Owner and Admin accounts.
        </div>
      </SettingsPageFrame>
    );
  }

  return (
    <SettingsPageFrame
      title="Admin Console"
      description="Inspect and manage administrative Verbal Sage systems."
    >
      <AdminConsolePage access={access} />
    </SettingsPageFrame>
  );
}
