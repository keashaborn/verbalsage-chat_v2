import { randomUUID } from "crypto";
import { NextRequest } from "next/server";

import {
  getLifeSwitchOwnerUserId,
  lifeSwitchUpstreamHeaders,
  unauthorizedLifeSwitch,
} from "@/app/api/lifeswitch/_owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (
  process.env.BRAINS_URL || "http://172.31.32.171:8088"
).replace(/\/+$/, "");
const MAX_BODY_BYTES = 256 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN_BODY_FIELDS = new Set([
  "actor_user_id",
  "owner_user_id",
  "owner_timezone",
  "permission_scopes",
]);

type RouteContext = { params: Promise<{ path: string[] }> };
type BodyMode = "none" | "json";
type Operation = {
  upstreamPath: string;
  method: "GET" | "POST" | "PUT";
  bodyMode: BodyMode;
  requiresIdempotency: boolean;
  queryFields: ReadonlySet<string>;
};

const COMMON_QUERY_FIELDS = new Set(["target_user_id"]);
const VERSION_LIST_QUERY_FIELDS = new Set([
  "target_user_id",
  "limit",
  "before_version",
]);

function jsonResponse(
  status: number,
  requestId: string,
  code: string,
  message: string,
): Response {
  return new Response(JSON.stringify({ detail: { code, message } }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": requestId,
    },
  });
}

function requestId(req: NextRequest): string {
  const supplied = String(req.headers.get("x-request-id") || "").trim();
  return supplied && supplied.length <= 128 ? supplied : randomUUID();
}

function ownerTimezone(req: NextRequest): string | null {
  const supplied = String(
    req.headers.get("x-lifeswitch-owner-timezone") || "UTC",
  ).trim();
  const value = supplied || "UTC";
  if (value.length > 80) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return null;
  }
}

function operationFor(method: string, path: string[]): Operation | null {
  const normalizedMethod = method.toUpperCase();

  if (normalizedMethod === "GET" && path.length === 1 && path[0] === "active") {
    return {
      upstreamPath: "/lifeswitch/plan/active",
      method: "GET",
      bodyMode: "none",
      requiresIdempotency: false,
      queryFields: COMMON_QUERY_FIELDS,
    };
  }
  if (
    normalizedMethod === "GET" &&
    path.length === 1 &&
    path[0] === "workspace"
  ) {
    return {
      upstreamPath: "/lifeswitch/plan/workspace",
      method: "GET",
      bodyMode: "none",
      requiresIdempotency: false,
      queryFields: COMMON_QUERY_FIELDS,
    };
  }
  if (
    normalizedMethod === "GET" &&
    path.length === 1 &&
    path[0] === "versions"
  ) {
    return {
      upstreamPath: "/lifeswitch/plan/versions",
      method: "GET",
      bodyMode: "none",
      requiresIdempotency: false,
      queryFields: VERSION_LIST_QUERY_FIELDS,
    };
  }
  if (
    normalizedMethod === "GET" &&
    path.length === 2 &&
    path[0] === "versions" &&
    UUID_PATTERN.test(path[1])
  ) {
    return {
      upstreamPath: `/lifeswitch/plan/versions/${encodeURIComponent(path[1])}`,
      method: "GET",
      bodyMode: "none",
      requiresIdempotency: false,
      queryFields: COMMON_QUERY_FIELDS,
    };
  }
  if (
    normalizedMethod === "POST" &&
    path.length === 1 &&
    path[0] === "revisions"
  ) {
    return {
      upstreamPath: "/lifeswitch/plan/revisions",
      method: "POST",
      bodyMode: "json",
      requiresIdempotency: true,
      queryFields: COMMON_QUERY_FIELDS,
    };
  }
  if (
    normalizedMethod === "POST" &&
    path.length === 2 &&
    path[0] === "revisions" &&
    path[1] === "adopt-current-profile"
  ) {
    return {
      upstreamPath: "/lifeswitch/plan/revisions/adopt-current-profile",
      method: "POST",
      bodyMode: "none",
      requiresIdempotency: true,
      queryFields: COMMON_QUERY_FIELDS,
    };
  }
  if (
    normalizedMethod === "POST" &&
    path.length === 2 &&
    path[0] === "revisions" &&
    path[1] === "from-current-profile"
  ) {
    return {
      upstreamPath: "/lifeswitch/plan/revisions/from-current-profile",
      method: "POST",
      bodyMode: "none",
      requiresIdempotency: true,
      queryFields: COMMON_QUERY_FIELDS,
    };
  }
  if (
    normalizedMethod === "POST" &&
    path.length === 3 &&
    path[0] === "revisions" &&
    path[1] === "adopt-current-profile" &&
    path[2] === "refresh"
  ) {
    return {
      upstreamPath: "/lifeswitch/plan/revisions/adopt-current-profile/refresh",
      method: "POST",
      bodyMode: "none",
      requiresIdempotency: true,
      queryFields: COMMON_QUERY_FIELDS,
    };
  }
  if (
    normalizedMethod === "GET" &&
    path.length === 2 &&
    path[0] === "revisions" &&
    UUID_PATTERN.test(path[1])
  ) {
    return {
      upstreamPath: `/lifeswitch/plan/revisions/${encodeURIComponent(path[1])}`,
      method: "GET",
      bodyMode: "none",
      requiresIdempotency: false,
      queryFields: COMMON_QUERY_FIELDS,
    };
  }
  if (
    normalizedMethod === "PUT" &&
    path.length === 3 &&
    path[0] === "revisions" &&
    UUID_PATTERN.test(path[1]) &&
    path[2] === "draft"
  ) {
    return {
      upstreamPath: `/lifeswitch/plan/revisions/${encodeURIComponent(path[1])}/draft`,
      method: "PUT",
      bodyMode: "json",
      requiresIdempotency: true,
      queryFields: COMMON_QUERY_FIELDS,
    };
  }
  if (
    normalizedMethod === "POST" &&
    path.length === 3 &&
    path[0] === "revisions" &&
    UUID_PATTERN.test(path[1]) &&
    path[2] === "refresh-current-profile"
  ) {
    return {
      upstreamPath: `/lifeswitch/plan/revisions/${encodeURIComponent(path[1])}/refresh-current-profile`,
      method: "POST",
      bodyMode: "none",
      requiresIdempotency: true,
      queryFields: COMMON_QUERY_FIELDS,
    };
  }
  if (
    normalizedMethod === "POST" &&
    path.length === 3 &&
    path[0] === "revisions" &&
    UUID_PATTERN.test(path[1]) &&
    (path[2] === "propose" || path[2] === "approve-and-activate")
  ) {
    return {
      upstreamPath: `/lifeswitch/plan/revisions/${encodeURIComponent(path[1])}/${path[2]}`,
      method: "POST",
      bodyMode: "none",
      requiresIdempotency: true,
      queryFields: COMMON_QUERY_FIELDS,
    };
  }
  return null;
}

function copyAllowedQuery(
  source: URLSearchParams,
  destination: URLSearchParams,
  allowed: ReadonlySet<string>,
): void {
  for (const name of allowed) {
    const value = source.get(name);
    if (value !== null && value !== "") destination.set(name, value);
  }
}

async function sanitizedJsonBody(
  req: NextRequest,
  requestIdValue: string,
): Promise<string | Response> {
  const declaredLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonResponse(
      413,
      requestIdValue,
      "request_too_large",
      "plan request is too large",
    );
  }

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return jsonResponse(
      413,
      requestIdValue,
      "request_too_large",
      "plan request is too large",
    );
  }
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonResponse(
        400,
        requestIdValue,
        "invalid_json_body",
        "JSON body must be an object",
      );
    }
    const clean = { ...(parsed as Record<string, unknown>) };
    for (const field of FORBIDDEN_BODY_FIELDS) delete clean[field];
    return JSON.stringify(clean);
  } catch {
    return jsonResponse(
      400,
      requestIdValue,
      "invalid_json_body",
      "request body is not valid JSON",
    );
  }
}

async function proxyPlanRequest(
  req: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const rid = requestId(req);
  const ownerUserId = await getLifeSwitchOwnerUserId(req);
  if (!ownerUserId) return unauthorizedLifeSwitch(rid);

  const { path } = await context.params;
  const operation = operationFor(req.method, path || []);
  if (!operation) {
    return jsonResponse(
      404,
      rid,
      "route_not_found",
      "plan route is unavailable",
    );
  }

  const timezone = ownerTimezone(req);
  if (!timezone) {
    return jsonResponse(
      422,
      rid,
      "invalid_owner_timezone",
      "owner timezone is invalid",
    );
  }

  const idempotencyKey = String(
    req.headers.get("idempotency-key") || "",
  ).trim();
  if (
    operation.requiresIdempotency &&
    (!idempotencyKey || idempotencyKey.length > 128)
  ) {
    return jsonResponse(
      400,
      rid,
      "invalid_idempotency_key",
      "Idempotency-Key is required and must not exceed 128 characters",
    );
  }

  let body: string | undefined;
  if (operation.bodyMode === "json") {
    const parsed = await sanitizedJsonBody(req, rid);
    if (parsed instanceof Response) return parsed;
    body = parsed;
  }

  const incomingUrl = new URL(req.url);
  const upstream = new URL(`${BRAINS_URL}${operation.upstreamPath}`);
  copyAllowedQuery(
    incomingUrl.searchParams,
    upstream.searchParams,
    operation.queryFields,
  );

  const headers = new Headers(lifeSwitchUpstreamHeaders(rid, ownerUserId));
  headers.set("x-vs-owner-timezone", timezone);
  if (operation.requiresIdempotency) {
    headers.set("idempotency-key", idempotencyKey);
  }

  try {
    const response = await fetch(upstream.toString(), {
      method: operation.method,
      headers,
      body,
      cache: "no-store",
    });
    const responseBody = await response.text().catch(() => "");
    return new Response(responseBody, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ||
          "application/json; charset=utf-8",
        "x-request-id": rid,
      },
    });
  } catch {
    return jsonResponse(
      502,
      rid,
      "brains_unreachable",
      "plan service is unavailable",
    );
  }
}

export async function GET(
  req: NextRequest,
  context: RouteContext,
): Promise<Response> {
  return await proxyPlanRequest(req, context);
}

export async function POST(
  req: NextRequest,
  context: RouteContext,
): Promise<Response> {
  return await proxyPlanRequest(req, context);
}

export async function PUT(
  req: NextRequest,
  context: RouteContext,
): Promise<Response> {
  return await proxyPlanRequest(req, context);
}
