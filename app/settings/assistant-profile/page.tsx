import { AssistantPreferences } from "@/components/settings/AssistantPreferences";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

export default function AssistantProfileSettingsPage() {
  return (
    <SettingsPageFrame
      title="Personalization"
      description="Choose what the assistant knows about you and how responses are presented."
    >
      <AssistantPreferences />
    </SettingsPageFrame>
  );
}
