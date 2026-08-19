import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import { getSupabaseBearerAuthorizationFromRequest } from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

export const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
};

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const INCIDENT_STATES = new Set(["open", "acknowledged", "resolved"]);
export const MAX_LIMIT = 100;
const MAX_UPSTREAM_BYTES = 1024 * 1024;
const INCIDENT_KEYS = new Set([
  "incident_id",
  "monitor_name",
  "state",
  "severity",
  "is_drill",
  "observation_status",
  "first_seen_at",
  "last_seen_at",
  "acknowledged_at",
  "acknowledged_by",
  "resolved_at",
  "resolved_by",
  "observation_count",
  "reason_codes",
  "window_hours",
  "request_count",
  "completed_count",
  "fail_closed_count",
  "relevance_fail_closed_count",
  "dependency_failure_count",
  "fail_closed_rate",
]);

export function requestId(req: Request): string {
  const raw = String(
    req.headers.get("x-request-id") ||
      req.headers.get("x-correlation-id") ||
      "",
  ).trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

export function fail(status: number, error: string, correlationId: string) {
  return NextResponse.json(
    { ok: false, error },
    {
      status,
      headers: { ...NO_STORE_HEADERS, "x-request-id": correlationId },
    },
  );
}

export async function authorizeAiOperations(
  req: Request,
  correlationId: string,
  capability: "inspector.view" | "incident.manage" = "inspector.view",
): Promise<
  | { ok: true; actorUserId: string; authorization: string }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireFreshCapability(req, capability);
  if (!auth.ok) {
    return {
      ok: false,
      response: fail(auth.status, auth.msg || "unauthorized", correlationId),
    };
  }
  const actorUserId = String(auth.auth?.user_id || "").trim();
  const authorization = getSupabaseBearerAuthorizationFromRequest(req);
  if (!UUID_PATTERN.test(actorUserId) || !authorization) {
    return {
      ok: false,
      response: fail(401, "unauthorized", correlationId),
    };
  }
  return { ok: true, actorUserId, authorization };
}

function aiOperationsBrainsUrl(): string {
  return (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(
    /\/+$/,
    "",
  );
}

export async function brainsAiOperationsJson(
  path: string,
  {
    actorUserId,
    authorization,
    correlationId,
  }: {
    actorUserId: string;
    authorization: string;
    correlationId: string;
  },
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const brainsUrl = aiOperationsBrainsUrl();
  try {
    const upstream = await fetch(`${brainsUrl}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: brainsUpstreamHeaders(correlationId, actorUserId, {
        Accept: "application/json",
        authorization,
        "x-vs-authorized-capability": "inspector.view",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) return { ok: false };
    const raw = await upstream.text();
    if (!raw || raw.length > MAX_UPSTREAM_BYTES) return { ok: false };
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

type IncidentMutationAction = "acknowledge" | "resolve";
type IncidentMutationState = "acknowledged" | "resolved";

function validMutation(
  value: any,
  incidentId: string,
  expectedState: IncidentMutationState,
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const expectedKeys = new Set([
    "ok",
    "schema",
    "source_contract_version",
    "action",
    "incident_id",
    "state",
  ]);
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.size &&
    keys.every((key) => expectedKeys.has(key)) &&
    value.ok === true &&
    value.schema === "admin_ai_operations_mutation_v1" &&
    value.source_contract_version === "ai_operations_monitor_mutation_v1" &&
    value.action === expectedState &&
    value.incident_id === incidentId &&
    value.state === expectedState
  );
}

export function hasUnexpectedRequestBody(req: Request): boolean {
  if (req.body === null) return false;

  // Browser fetch represents an explicitly empty POST as a zero-length
  // stream. Accept that wire-compatible shape while rejecting any payload.
  const contentLength = req.headers.get("content-length");
  return contentLength !== "0";
}

export async function mutateAiOperationsIncident(
  req: Request,
  incidentId: string,
  action: IncidentMutationAction,
) {
  const correlationId = requestId(req);
  const auth = await authorizeAiOperations(
    req,
    correlationId,
    "incident.manage",
  );
  if (!auth.ok) return auth.response;
  if (hasUnexpectedRequestBody(req)) {
    return fail(400, "unexpected_request_body", correlationId);
  }
  if (!UUID_PATTERN.test(incidentId)) {
    return fail(400, "invalid_incident_id", correlationId);
  }

  const expectedState: IncidentMutationState =
    action === "acknowledge" ? "acknowledged" : "resolved";
  const path = `/admin/ai-operations/incidents/${encodeURIComponent(
    incidentId,
  )}/${action}`;
  try {
    const upstream = await fetch(`${aiOperationsBrainsUrl()}${path}`, {
      method: "POST",
      cache: "no-store",
      headers: brainsUpstreamHeaders(correlationId, auth.actorUserId, {
        Accept: "application/json",
        authorization: auth.authorization,
        "x-vs-authorized-capability": "incident.manage",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) {
      if (upstream.status === 404) {
        return fail(404, "monitor_incident_not_found", correlationId);
      }
      if (upstream.status === 409) {
        return fail(409, "invalid_incident_transition", correlationId);
      }
      return fail(502, "ai_operations_unavailable", correlationId);
    }
    const raw = await upstream.text();
    if (!raw || raw.length > MAX_UPSTREAM_BYTES) {
      return fail(502, "ai_operations_unavailable", correlationId);
    }
    const value = JSON.parse(raw);
    if (!validMutation(value, incidentId, expectedState)) {
      return fail(502, "ai_operations_unavailable", correlationId);
    }
    return noStoreJson(value, correlationId);
  } catch {
    return fail(502, "ai_operations_unavailable", correlationId);
  }
}

function isTimestampOrNull(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === "string" && value.length >= 1 && value.length <= 64)
  );
}

function isUuidOrNull(value: unknown): boolean {
  return value === null || UUID_PATTERN.test(String(value || ""));
}

function isBoundedInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validIncident(item: any): boolean {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  const keys = Object.keys(item);
  if (
    keys.length !== INCIDENT_KEYS.size ||
    keys.some((key) => !INCIDENT_KEYS.has(key))
  ) {
    return false;
  }
  if (!UUID_PATTERN.test(String(item.incident_id || ""))) return false;
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(String(item.monitor_name || ""))) {
    return false;
  }
  if (!INCIDENT_STATES.has(item.state)) return false;
  if (!["info", "warning", "critical", "test"].includes(item.severity)) {
    return false;
  }
  if (typeof item.is_drill !== "boolean") return false;
  if (!["violated", "unavailable", "drill"].includes(item.observation_status)) {
    return false;
  }
  for (const key of [
    "first_seen_at",
    "last_seen_at",
    "acknowledged_at",
    "resolved_at",
  ]) {
    if (!isTimestampOrNull(item[key])) return false;
  }
  if (!isUuidOrNull(item.acknowledged_by) || !isUuidOrNull(item.resolved_by)) {
    return false;
  }
  for (const key of [
    "observation_count",
    "window_hours",
    "request_count",
    "completed_count",
    "fail_closed_count",
    "relevance_fail_closed_count",
    "dependency_failure_count",
  ]) {
    if (!isBoundedInteger(item[key])) return false;
  }
  if (
    !Array.isArray(item.reason_codes) ||
    item.reason_codes.length > 16 ||
    item.reason_codes.some(
      (reason: unknown) => typeof reason !== "string" || reason.length > 128,
    )
  ) {
    return false;
  }
  return (
    typeof item.fail_closed_rate === "number" &&
    Number.isFinite(item.fail_closed_rate) &&
    item.fail_closed_rate >= 0 &&
    item.fail_closed_rate <= 1
  );
}

export function validInbox(value: any, limit: number): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (
    value.ok !== true ||
    value.schema !== "admin_ai_operations_incidents_v1" ||
    value.source_contract_version !== "ai_operations_monitor_inbox_v1" ||
    !Array.isArray(value.items) ||
    value.items.length > limit ||
    value.items.some((item: unknown) => !validIncident(item))
  ) {
    return false;
  }
  return (
    Object.keys(value).length === 4 &&
    ["ok", "schema", "source_contract_version", "items"].every((key) =>
      Object.hasOwn(value, key),
    )
  );
}

export function noStoreJson(value: unknown, correlationId: string) {
  return NextResponse.json(value, {
    headers: { ...NO_STORE_HEADERS, "x-request-id": correlationId },
  });
}
