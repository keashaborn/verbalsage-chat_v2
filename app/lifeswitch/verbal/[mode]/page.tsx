import { redirect } from "next/navigation";

const MODES = new Set(["log", "design", "capture", "plan", "analyze"]);

export default async function VerbalModePage({
  params,
}: {
  params: Promise<{ mode?: string }>;
}) {
  const { mode: rawMode } = await params;
  const mode = (rawMode || "").toLowerCase();
  if (!MODES.has(mode)) redirect("/lifeswitch/verbal/design");

  if (mode === "capture") redirect("/lifeswitch/verbal/capture");
  if (mode === "design") redirect("/lifeswitch/verbal/design");
  if (mode === "analyze") redirect("/lifeswitch/verbal/analyze");
  if (mode === "log") redirect("/lifeswitch/verbal/log");
  if (mode === "plan") redirect("/lifeswitch/verbal/plan");

  redirect("/lifeswitch/verbal/design");
}
