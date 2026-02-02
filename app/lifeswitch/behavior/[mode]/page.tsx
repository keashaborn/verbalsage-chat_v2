import { redirect } from "next/navigation";

const MODES = new Set(["log", "design", "capture", "plan", "analyze"]);

export default function BehaviorModePage({ params }: { params: { mode?: string } }) {
  const mode = (params?.mode || "").toLowerCase();
  if (!MODES.has(mode)) redirect("/lifeswitch/behavior/design");

  if (mode === "capture") redirect("/lifeswitch/behavior/capture");
  if (mode === "design") redirect("/lifeswitch/behavior/design");
  if (mode === "analyze") redirect("/lifeswitch/behavior/analyze");
  if (mode === "log") redirect("/lifeswitch/behavior/log");
  if (mode === "plan") redirect("/lifeswitch/behavior/plan");

  redirect("/lifeswitch/behavior/design");
}
