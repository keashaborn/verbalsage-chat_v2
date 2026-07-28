import {
  authorizeUsage,
  brainsUsageJson,
  fail,
  noStoreJson,
  parseWindow,
  requestId,
} from "@/app/api/admin/usage/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const correlationId = requestId(req);
  const auth = await authorizeUsage(req, correlationId);
  if (!auth.ok) return auth.response;

  const windowDays = parseWindow(
    new URL(req.url).searchParams.get("window"),
    30,
  );
  if (windowDays === null) {
    return fail(400, "invalid_usage_window", correlationId);
  }

  const upstream = await brainsUsageJson(
    `/admin/usage/overview?window=${windowDays}`,
    {
      actorUserId: auth.actorUserId,
      correlationId,
    },
  );
  if (
    !upstream.ok ||
    !upstream.value?.ok ||
    upstream.value?.schema !== "admin_usage_overview_v1"
  ) {
    return fail(502, "usage_overview_unavailable", correlationId);
  }
  return noStoreJson(upstream.value, correlationId);
}
