import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
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
): Promise<
  { ok: true; actorUserId: string } | { ok: false; response: NextResponse }
> {
  const auth = await requireFreshCapability(req, "inspector.view");
  if (!auth.ok) {
    return {
      ok: false,
      response: fail(auth.status, auth.msg || "unauthorized", correlationId),
    };
  }
  const actorUserId = String(auth.auth?.user_id || "").trim();
  if (!UUID_PATTERN.test(actorUserId)) {
    return {
      ok: false,
      response: fail(401, "unauthorized", correlationId),
    };
  }
  return { ok: true, actorUserId };
}

export async function brainsAiOperationsJson(
  path: string,
  {
    actorUserId,
    correlationId,
  }: {
    actorUserId: string;
    correlationId: string;
  },
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const brainsUrl = (
    process.env.BRAINS_URL || "http://172.31.32.171:8088"
  ).replace(/\/+$/, "");
  try {
    const upstream = await fetch(`${brainsUrl}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: brainsUpstreamHeaders(correlationId, actorUserId, {
        Accept: "application/json",
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
