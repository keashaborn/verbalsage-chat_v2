import { redirect } from "next/navigation";

export default async function SSLGRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const qs = new URLSearchParams();

  for (const [k, v] of Object.entries(resolvedSearchParams || {})) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      for (const x of v) qs.append(k, x);
    } else {
      qs.set(k, v);
    }
  }

  const q = qs.toString();
  redirect(`/developer/sslg${q ? `?${q}` : ""}`);
}
