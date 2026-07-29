import { VoicePanel } from "@/components/admin/VoicePanel";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

export default function VoiceSettingsPage() {
  return (
    <SettingsPageFrame
      title="Voice"
      description="Choose the voice used for spoken replies."
    >
      <VoicePanel />
    </SettingsPageFrame>
  );
}
