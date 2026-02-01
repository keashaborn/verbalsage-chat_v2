import { redirect } from "next/navigation";

const MODES = new Set(["log", "design", "capture", "plan", "analyze"]);

export default function MeasurementsModePage({ params }: { params: { mode: string } }) {
  const mode = (params.mode || "").toLowerCase();
  if (!MODES.has(mode)) redirect("/lifeswitch/measurements/log");
  if (mode === "capture") redirect("/collect");
  redirect("/lifeswitch/measurements");
}
