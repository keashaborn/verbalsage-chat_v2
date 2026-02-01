import { redirect } from "next/navigation";

const MODES = new Set(["log", "design", "capture", "plan", "analyze"]);

export default function NutritionModePage({ params }: { params: { mode: string } }) {
  const mode = (params.mode || "").toLowerCase();
  if (!MODES.has(mode)) redirect("/lifeswitch/nutrition/log");

  if (mode === "capture") redirect("/collect");

  // TEMP mappings (until real pages exist)
  if (mode === "design") redirect("/lifeswitch/nutrition/foods");
  if (mode === "plan") redirect("/lifeswitch/nutrition/meal-plans");
  if (mode === "log") redirect("/lifeswitch/nutrition/meal-plans");     // TODO: real log UI
  if (mode === "analyze") redirect("/lifeswitch/nutrition/meal-plans"); // TODO: real analyze UI

  redirect("/lifeswitch/nutrition/log");
}
