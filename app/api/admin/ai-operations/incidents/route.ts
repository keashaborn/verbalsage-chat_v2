import {
  INCIDENT_STATES,
  MAX_LIMIT,
  authorizeAiOperations,
  brainsAiOperationsJson,
  fail,
  noStoreJson,
  requestId,
  validInbox,
} from "@/app/api/admin/ai-operations/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const correlationId = requestId(req);
  const auth = await authorizeAiOperations(req, correlationId);
  if (!auth.ok) return auth.response;

  const incoming = new URL(req.url).searchParams;
  const state = String(incoming.get("state") || "").trim();
  const limit = Number(incoming.get("limit") || 50);
  if (
    (state && !INCIDENT_STATES.has(state)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_LIMIT
  ) {
    return fail(400, "invalid_ai_operations_query", correlationId);
  }

  const params = new URLSearchParams({ limit: String(limit) });
  if (state) params.set("state", state);
  const upstream = await brainsAiOperationsJson(
    `/admin/ai-operations/incidents?${params.toString()}`,
    {
      actorUserId: auth.actorUserId,
      authorization: auth.authorization,
      correlationId,
    },
  );
  if (!upstream.ok || !validInbox(upstream.value, limit)) {
    return fail(502, "ai_operations_unavailable", correlationId);
  }
  return noStoreJson(upstream.value, correlationId);
}
