"use client";

import { SecurityPanel } from "@/components/admin/SecurityPanel";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

export default function SecuritySettingsPage() {
  return (
    <SettingsPageFrame
      title="Security"
      description="Manage security-sensitive account controls."
    >
      <SecurityPanel onDone={() => window.location.reload()} />
    </SettingsPageFrame>
  );
}
