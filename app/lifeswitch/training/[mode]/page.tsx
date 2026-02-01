import { redirect } from "next/navigation";

const MODES = new Set(["log", "design", "capture", "plan", "analyze"]);

export default function TrainingModePage({ params }: { params: { mode?: string } }) {
  const mode = (params?.mode || "").toLowerCase();

  if (!MODES.has(mode)) redirect("/lifeswitch/training/log");

  if (mode === "capture") redirect("/collect?domain=training");
  if (mode === "design") redirect("/lifeswitch/training/design");

  // Keep current behavior until we build proper Plan/Analyze pages.
  if (mode === "plan") redirect("/lifeswitch/training/plan");
  if (mode === "log") redirect("/lifeswitch/training/calendar");
  if (mode === "analyze") redirect("/lifeswitch/training/analyze");

  redirect("/lifeswitch/training/log");
}
