"use client";

import { DataPrivacyPanel } from "@/components/settings/DataPrivacyPanel";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

export default function DataPrivacySettingsPage() {
  return (
    <SettingsPageFrame title="Data & Privacy">
      <DataPrivacyPanel />
    </SettingsPageFrame>
  );
}
