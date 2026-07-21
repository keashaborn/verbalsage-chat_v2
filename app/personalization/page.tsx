import { redirect } from "next/navigation";

export default function LegacyPersonalizationRedirect() {
  redirect("/settings/assistant-profile");
}
