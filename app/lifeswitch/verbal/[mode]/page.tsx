import { redirect } from "next/navigation";

const MODES = new Set(["log", "design", "capture", "plan", "analyze"]);

export default function VerbalModePage({ params }: { params: { mode?: string } }) {
  const mode = (params?.mode || "").toLowerCase();
  if (!MODES.has(mode)) redirect("/lifeswitch/verbal/design");

  if (mode === "capture") redirect("/collect?domain=verbal");
  if (mode === "design") redirect("/lifeswitch/verbal/design");
  if (mode === "analyze") redirect("/lifeswitch/verbal/analyze");
  if (mode === "log") redirect("/lifeswitch/verbal/log");
  if (mode === "plan") redirect("/lifeswitch/verbal/plan");

  redirect("/lifeswitch/verbal/design");
}
