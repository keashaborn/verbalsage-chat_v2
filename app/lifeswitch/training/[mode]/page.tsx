import { redirect } from "next/navigation";

const MODES = new Set(["log", "design", "capture", "plan", "analyze"]);

export default async function TrainingModePage({
  params,
}: {
  params: Promise<{ mode?: string }>;
}) {
  const { mode: rawMode } = await params;
  const mode = (rawMode || "").toLowerCase();

  // Never fall back to /lifeswitch/training/log to avoid self-loop.
  if (!MODES.has(mode)) redirect("/lifeswitch/training/calendar");

  if (mode === "capture") redirect("/lifeswitch/training/capture");
  if (mode === "design") redirect("/lifeswitch/training/design");

  // For now: map log/analyze to calendar until analyze exists
  if (mode === "log") redirect("/lifeswitch/training/calendar");
  if (mode === "plan") redirect("/lifeswitch/training/plan");
  if (mode === "analyze") redirect("/lifeswitch/training/analyze");

  redirect("/lifeswitch/training/calendar");
}
