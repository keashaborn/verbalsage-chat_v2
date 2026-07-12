import { redirect } from "next/navigation";

const MODES = new Set(["log", "design", "capture", "plan", "analyze"]);

export default async function NutritionModePage({
  params,
}: {
  params: Promise<{ mode?: string }>;
}) {
  const { mode: rawMode } = await params;
  const mode = (rawMode || "").toLowerCase();

  if (!MODES.has(mode)) redirect("/lifeswitch/nutrition/design");
  if (mode === "capture") redirect("/lifeswitch/nutrition/capture");
  if (mode === "design") redirect("/lifeswitch/nutrition/design");
  if (mode === "plan") redirect("/lifeswitch/nutrition/plan");
  if (mode === "log") redirect("/lifeswitch/nutrition/log");
  if (mode === "analyze") redirect("/lifeswitch/nutrition/analyze");

  redirect("/lifeswitch/nutrition/design");
}
