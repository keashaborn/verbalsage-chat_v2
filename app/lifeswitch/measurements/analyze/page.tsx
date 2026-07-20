import { redirect } from "next/navigation";

type LegacySearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function LegacyMeasurementsAnalyzePage({
  searchParams,
}: {
  searchParams: LegacySearchParams;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value != null) params.set(key, value);
  }

  params.set("view", "progress");
  redirect(`/lifeswitch/measurements?${params.toString()}`);
}
