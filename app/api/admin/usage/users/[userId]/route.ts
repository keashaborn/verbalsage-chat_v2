import {
  UUID_PATTERN,
  authorizeUsage,
  brainsUsageJson,
  fail,
  noStoreJson,
  parseWindow,
  requestId,
  visibleIdentity,
} from "@/app/api/admin/usage/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const correlationId = requestId(req);
  const auth = await authorizeUsage(req, correlationId);
  if (!auth.ok) return auth.response;

  const { userId } = await context.params;
  if (!UUID_PATTERN.test(userId)) {
    return fail(400, "invalid_user_id", correlationId);
  }
  const windowDays = parseWindow(
    new URL(req.url).searchParams.get("window"),
    90,
  );
  if (windowDays === null) {
    return fail(400, "invalid_usage_window", correlationId);
  }

  const upstream = await brainsUsageJson(
    `/admin/usage/users/${encodeURIComponent(userId)}?window=${windowDays}`,
    {
      actorUserId: auth.actorUserId,
      correlationId,
    },
  );
  const value = upstream.ok ? upstream.value : null;
  if (
    !value?.ok ||
    value?.schema !== "admin_usage_user_detail_v1" ||
    value?.user_id !== userId ||
    !Array.isArray(value?.daily)
  ) {
    return fail(502, "usage_user_detail_unavailable", correlationId);
  }

  return noStoreJson(
    {
      ...value,
      identity: await visibleIdentity(userId),
    },
    correlationId,
  );
}
