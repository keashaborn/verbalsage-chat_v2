import { redirect } from "next/navigation";

export default async function MeasurementsModePage({
  params,
}: {
  params: Promise<{ mode?: string }>;
}) {
  const { mode: rawMode } = await params;
  const mode = (rawMode || "").toLowerCase();

  if (mode === "capture") redirect("/lifeswitch/measurements/capture");
  if (mode === "analyze") redirect("/lifeswitch/measurements?view=progress");
  if (mode === "plan") redirect("/lifeswitch/measurements");

  redirect("/lifeswitch/measurements");
}
