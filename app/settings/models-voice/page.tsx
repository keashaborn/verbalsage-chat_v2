import { redirect } from "next/navigation";

export default function LegacyVoiceSettingsRedirect() {
  redirect("/settings/assistant-profile");
}
