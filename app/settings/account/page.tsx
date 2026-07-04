"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

function displayNameFromUser(user: any) {
  return (
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    (user?.email as string | undefined)?.trim() ||
    "Signed in user"
  );
}

export default function AccountSettingsPage() {
  const [label, setLabel] = React.useState("Loading…");
  const [email, setEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!alive) return;

        const user = data.user;
        setLabel(displayNameFromUser(user));
        setEmail((user?.email as string | undefined) || null);
      } catch {
        if (!alive) return;
        setLabel("Signed in user");
        setEmail(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/";
  }

  return (
    <SettingsPageFrame
      title="Account"
      description="Review the active session and account identity."
    >
      <div className="space-y-4">
        <div className="rounded-xl border p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Signed in as
          </div>
          <div className="mt-2 text-sm font-semibold">{label}</div>
          {email ? <div className="mt-1 text-xs text-muted-foreground">{email}</div> : null}
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
        >
          Sign out
        </button>
      </div>
    </SettingsPageFrame>
  );
}
