"use client";

import { PersonalizationPanel } from "@/components/admin/PersonalizationPanel";
import { SettingsStoreProvider } from "@/components/admin/settings/store";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

export default function AppearanceSettingsPage() {
  return (
    <SettingsStoreProvider open={true}>
      <SettingsPageFrame
        title="Appearance"
        description="Adjust the interface appearance for LifeSwitch and Verbal Sage."
      >
        <PersonalizationPanel />
      </SettingsPageFrame>
    </SettingsStoreProvider>
  );
}
