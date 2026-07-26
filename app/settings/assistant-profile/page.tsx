import { AssistantPreferences } from "@/components/settings/AssistantPreferences";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

export default function AssistantProfileSettingsPage() {
  return (
    <SettingsPageFrame
      title="Personalization"
      description="Set how RESSE responds and sounds."
    >
      <AssistantPreferences />
    </SettingsPageFrame>
  );
}
