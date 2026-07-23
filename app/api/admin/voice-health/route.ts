export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCapability } from "@/app/api/_auth/requireCapability";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import { buildAdminVoiceHealth } from "@/lib/adminVoiceHealth";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestId(req: Request): string {
  return (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    crypto.randomUUID()
  ).trim();
}

function errorResponse(
  status: number,
  error: string,
  correlationId: string,
) {
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
  const auth = await requireCapability(req, "diagnostics.view");
  if (!auth.ok) {
    return errorResponse(auth.status, auth.msg, correlationId);
  }

  const canaryActor = (
    process.env.VOICE_CANARY_ACTOR_USER_ID || ""
  ).trim();
  if (!UUID_PATTERN.test(canaryActor)) {
    return errorResponse(
      503,
      "voice_health_not_configured",
      correlationId,
    );
  }

  const brainsUrl = (
    process.env.BRAINS_URL || "http://172.31.32.171:8088"
  ).replace(/\/+$/, "");

  try {
    const upstream = await fetch(
      `${brainsUrl}/metrics/voice-slo?window_days=30`,
      {
        method: "GET",
        cache: "no-store",
        headers: brainsUpstreamHeaders(correlationId, canaryActor),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!upstream.ok) {
      return errorResponse(
        502,
        "voice_health_unavailable",
        correlationId,
      );
    }

    const payload = buildAdminVoiceHealth(await upstream.json());
    return NextResponse.json(payload, {
      headers: { ...NO_STORE_HEADERS, "x-request-id": correlationId },
    });
  } catch {
    return errorResponse(502, "voice_health_unavailable", correlationId);
  }
}
