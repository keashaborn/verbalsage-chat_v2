"use client";

import { SecurityPanel } from "@/components/admin/SecurityPanel";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

export default function SecuritySettingsPage() {
  return (
    <SettingsPageFrame title="Security">
      <SecurityPanel view="security" />
    </SettingsPageFrame>
  );
}
