import { redirect } from "next/navigation";

const MODES = new Set(["log", "design", "capture", "plan", "analyze"]);

export default function TrainingModePage({ params }: { params: { mode: string } }) {
  const mode = (params.mode || "").toLowerCase();
  if (!MODES.has(mode)) redirect("/lifeswitch/training/log");

  if (mode === "capture") redirect("/collect");

  // TEMP mappings (until real pages exist)
  if (mode === "design") redirect("/lifeswitch/training/exercises");
  if (mode === "plan") redirect("/lifeswitch/training/workouts");
  if (mode === "log") redirect("/lifeswitch/training/calendar");
  if (mode === "analyze") redirect("/lifeswitch/training/calendar"); // TODO: real analyze UI

  redirect("/lifeswitch/training/log");
}
