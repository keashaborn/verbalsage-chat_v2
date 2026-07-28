import {
  DEFAULT_LIMIT,
  MAX_CURSOR_LENGTH,
  MAX_LIMIT,
  MAX_QUERY_LENGTH,
  SORTS,
  UUID_PATTERN,
  UUID_PREFIX_PATTERN,
  authorizeUsage,
  brainsUsageJson,
  fail,
  noStoreJson,
  parseWindow,
  requestId,
  visibleIdentities,
} from "@/app/api/admin/usage/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const correlationId = requestId(req);
  const auth = await authorizeUsage(req, correlationId);
  if (!auth.ok) return auth.response;

  const incoming = new URL(req.url).searchParams;
  const windowDays = parseWindow(incoming.get("window"), 30);
  const limit = Number(incoming.get("limit") || DEFAULT_LIMIT);
  const sort = incoming.get("sort") || "total_tokens_desc";
  const cursor = String(incoming.get("cursor") || "").trim();
  const query = String(incoming.get("query") || "").trim().toLowerCase();
  if (
    windowDays === null ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_LIMIT ||
    !SORTS.has(sort) ||
    cursor.length > MAX_CURSOR_LENGTH ||
    query.length > MAX_QUERY_LENGTH ||
    (query.length > 0 && !UUID_PREFIX_PATTERN.test(query))
  ) {
    return fail(400, "invalid_usage_query", correlationId);
  }

  const params = new URLSearchParams({
    window: String(windowDays),
    limit: String(limit),
    sort,
  });
  if (cursor) params.set("cursor", cursor);
  if (query) params.set("query", query);

  const upstream = await brainsUsageJson(
    `/admin/usage/users?${params.toString()}`,
    {
      actorUserId: auth.actorUserId,
      correlationId,
    },
  );
  const value = upstream.ok ? upstream.value : null;
  if (
    !value?.ok ||
    value?.schema !== "admin_usage_users_v1" ||
    !Array.isArray(value?.items) ||
    value.items.length > MAX_LIMIT ||
    !(
      value?.next_cursor === null ||
      (typeof value?.next_cursor === "string" &&
        value.next_cursor.length <= MAX_CURSOR_LENGTH)
    ) ||
    typeof value?.has_more !== "boolean" ||
    value.items.some(
      (item: any) => !UUID_PATTERN.test(String(item?.user_id || "")),
    )
  ) {
    return fail(502, "usage_users_unavailable", correlationId);
  }

  const identities = await visibleIdentities(
    value.items.map((item: any) => String(item.user_id)),
  );
  return noStoreJson(
    {
      ...value,
      items: value.items.map((item: any) => ({
        ...item,
        identity: identities.get(String(item.user_id)) || null,
      })),
    },
    correlationId,
  );
}
