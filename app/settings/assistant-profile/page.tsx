"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { VantageProfilePage } from "@/components/admin/settings/VantageProfilePage";
import { VantagePersonalizationEditor } from "@/components/admin/settings/VantagePersonalizationEditor";
import { SettingsStoreProvider } from "@/components/admin/settings/store";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

export default function AssistantProfileSettingsPage() {
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [editingVantageId, setEditingVantageId] = React.useState<string | null>(null);

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

  return (
    <SettingsStoreProvider open={true}>
      <SettingsPageFrame
        title={editingVantageId ? "Assistant Personalization" : "Assistant Profile"}
        description={
          editingVantageId
            ? "Edit the selected assistant profile personalization controls."
            : "Configure the active assistant profile."
        }
      >
        {editingVantageId ? (
          <div className="space-y-4">
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted/40"
              onClick={() => setEditingVantageId(null)}
            >
              Back to Assistant Profile
            </button>
            <VantagePersonalizationEditor vantageId={editingVantageId} />
          </div>
        ) : (
          <VantageProfilePage
            isAdmin={isAdmin}
            onEditPersonalization={(vid) => {
              setEditingVantageId(
                String(vid || "RESSE").trim().slice(0, 64).toUpperCase() || "RESSE",
              );
            }}
          />
        )}
      </SettingsPageFrame>
    </SettingsStoreProvider>
  );
}
