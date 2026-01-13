import { redirect } from "next/navigation";

export default function SSLGRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();

  for (const [k, v] of Object.entries(searchParams || {})) {
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
