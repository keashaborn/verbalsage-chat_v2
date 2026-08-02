import { AssistantPreferences } from "@/components/settings/AssistantPreferences";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

export default function AssistantProfileSettingsPage() {
  return (
    <SettingsPageFrame title="Personalization">
      <AssistantPreferences />
    </SettingsPageFrame>
  );
}
