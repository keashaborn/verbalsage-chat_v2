import { redirect } from "next/navigation";

const DOMAINS = new Set(["nutrition", "training", "measurements"]);
const MODES = new Set(["log", "design", "capture", "plan", "analyze"]);

function bad() {
  redirect("/lifeswitch");
}

export default function LifeSwitchDomainModePage({
  params,
  searchParams,
}: {
  params: { domain: string; mode: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const domain = (params.domain || "").toLowerCase();
  const mode = (params.mode || "").toLowerCase();

  if (!DOMAINS.has(domain) || !MODES.has(mode)) bad();

  // Capture is currently a global workspace
  if (mode === "capture") redirect("/collect");

  // Measurements is currently a single page; map everything to it for now
  if (domain === "measurements") redirect("/lifeswitch/measurements");

  // Nutrition mappings (legacy pages)
  if (domain === "nutrition") {
    if (mode === "design") redirect("/lifeswitch/nutrition/foods");       // later: /design?tab=foods
    if (mode === "plan") redirect("/lifeswitch/nutrition/meal-plans");
    if (mode === "log") redirect("/lifeswitch/nutrition/meal-plans");      // placeholder until real log UI
    if (mode === "analyze") redirect("/lifeswitch/nutrition/meal-plans");  // placeholder until analysis UI
  }

  // Training mappings (legacy pages)
  if (domain === "training") {
    if (mode === "design") redirect("/lifeswitch/training/exercises");     // later: /design?tab=exercises
    if (mode === "plan") redirect("/lifeswitch/training/workouts");
    if (mode === "log") redirect("/lifeswitch/training/calendar");
    if (mode === "analyze") redirect("/lifeswitch/training/calendar");     // placeholder until analysis UI
  }

  bad();
}
