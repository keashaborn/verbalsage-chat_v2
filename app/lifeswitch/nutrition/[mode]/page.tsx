import { redirect } from "next/navigation";

const MODES = new Set(["log", "design", "capture", "plan", "analyze"]);

export default function NutritionModePage({ params }: { params: { mode?: string } }) {
  const mode = (params?.mode || "").toLowerCase();

  if (!MODES.has(mode)) redirect("/lifeswitch/nutrition/design");
  if (mode === "capture") redirect("/collect?domain=nutrition");
  if (mode === "design") redirect("/lifeswitch/nutrition/design");
  if (mode === "plan") redirect("/lifeswitch/nutrition/plan");
  if (mode === "log") redirect("/lifeswitch/nutrition/log");
  if (mode === "analyze") redirect("/lifeswitch/nutrition/analyze");

  redirect("/lifeswitch/nutrition/design");
}
