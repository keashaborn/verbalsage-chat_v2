export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestId(req: Request): string {
  const raw = (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    ""
  ).trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

function errorResponse(status: number, error: string, correlationId: string) {
  return NextResponse.json(
    { ok: false, error },
    {
      status,
      headers: { ...NO_STORE_HEADERS, "x-request-id": correlationId },
    },
  );
}

export async function GET(req: Request) {
  const correlationId = requestId(req);
  const auth = await requireFreshCapability(req, "memory_system.view");
  if (!auth.ok) {
    return errorResponse(
      auth.status,
      auth.msg || "unauthorized",
      correlationId,
    );
  }

  const actorUserId = String((auth as any).payload?.sub || "").trim();
  if (!UUID_PATTERN.test(actorUserId)) {
    return errorResponse(401, "unauthorized", correlationId);
  }

  const brainsUrl = (
    process.env.BRAINS_URL || "http://172.31.32.171:8088"
  ).replace(/\/+$/, "");

  try {
    const upstream = await fetch(`${brainsUrl}/admin/memory/health`, {
      method: "GET",
      cache: "no-store",
      headers: brainsUpstreamHeaders(correlationId, actorUserId, {
        Accept: "application/json",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) {
      return errorResponse(502, "memory_health_unavailable", correlationId);
    }

    const payload = await upstream.json();
    if (
      !payload?.ok ||
      payload?.schema !== "admin_memory_health_v1" ||
      payload?.scope !== "current_actor"
    ) {
      return errorResponse(502, "memory_health_unavailable", correlationId);
    }
    return NextResponse.json(payload, {
      headers: { ...NO_STORE_HEADERS, "x-request-id": correlationId },
    });
  } catch {
    return errorResponse(502, "memory_health_unavailable", correlationId);
  }
}
