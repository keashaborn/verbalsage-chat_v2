import { MeasurementWorkspace } from "@/components/lifeswitch/measurements/MeasurementWorkspace";

type MeasurementSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function firstValue(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] || "" : value || "").trim();
}

export default async function MeasurementsHome({
  searchParams,
}: {
  searchParams: MeasurementSearchParams;
}) {
  const raw = await searchParams;

  return (
    <MeasurementWorkspace
      targetUserId={firstValue(raw.target_user_id)}
      targetName={firstValue(raw.target_name)}
    />
  );
}
