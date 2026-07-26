"use client";

import { SecurityPanel } from "@/components/admin/SecurityPanel";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

export default function SecuritySettingsPage() {
  return (
    <SettingsPageFrame
      title="Security"
      description="Manage password access, active sessions, and private data controls."
    >
      <SecurityPanel />
    </SettingsPageFrame>
  );
}
