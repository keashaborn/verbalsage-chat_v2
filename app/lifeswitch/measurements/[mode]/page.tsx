import { redirect } from "next/navigation";

const MODES = new Set(["log", "design", "capture", "plan", "analyze"]);

export default async function MeasurementsModePage({
  params,
}: {
  params: Promise<{ mode?: string }>;
}) {
  const { mode: rawMode } = await params;
  const mode = (rawMode || "").toLowerCase();

  if (!MODES.has(mode)) redirect("/lifeswitch/measurements/log");
  if (mode === "log") redirect("/lifeswitch/measurements/log");
  if (mode === "design") redirect("/lifeswitch/measurements/design");
  if (mode === "capture") redirect("/lifeswitch/measurements/capture");
  if (mode === "analyze") redirect("/lifeswitch/measurements/analyze");
  if (mode === "plan") redirect("/lifeswitch/plan?section=measurements#body-state");

  redirect("/lifeswitch/measurements/log");
}
