import { redirect } from "next/navigation";

const MODES = new Set(["log", "design", "capture", "plan", "analyze"]);

export default function NutritionModePage({ params }: { params: { mode?: string } }) {
  const mode = (params?.mode || "").toLowerCase();

  // Never redirect back into /lifeswitch/nutrition/<mode> as a fallback.
  // Always fall back to a concrete legacy page.
  if (!MODES.has(mode)) redirect("/lifeswitch/nutrition/foods");

  if (mode === "capture") redirect("/collect");
  if (mode === "design") redirect("/lifeswitch/nutrition/foods");
  if (mode === "plan") redirect("/lifeswitch/nutrition/meal-plans");

  // TEMP until real pages exist
  if (mode === "log") redirect("/lifeswitch/nutrition/meal-plans");
  if (mode === "analyze") redirect("/lifeswitch/nutrition/meal-plans");

  redirect("/lifeswitch/nutrition/foods");
}
