import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import {
  VOICE_SESSION_HEADER,
  voiceSessionIdFromRequest,
} from "@/lib/voiceSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SDP_BYTES = 128 * 1024;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE_HEADERS = {
  "cache-control": "private, no-store, max-age=0, must-revalidate",
  pragma: "no-cache",
  expires: "0",
  "x-content-type-options": "nosniff",
};

function errorResponse(requestId: string, status: number, error: string) {
  return NextResponse.json(
    { ok: false, error },
    {
      status,
      headers: { ...NO_STORE_HEADERS, "x-request-id": requestId },
    },
  );
}

export async function POST(req: Request) {
  const requestId = randomUUID();
  const capability = await requireFreshCapability(
    req,
    "voice.realtime_preview",
  );
  if (!capability.ok) {
    return errorResponse(
      requestId,
      capability.status,
      String(capability.msg || "capability required"),
    );
  }

  const userId = String(capability.payload?.sub || "").trim();
  if (!UUID_RE.test(userId)) {
    return errorResponse(requestId, 401, "unauthorized");
  }

  const voiceSession = voiceSessionIdFromRequest(req);
  if (!voiceSession.supplied || !voiceSession.value) {
    return errorResponse(requestId, 400, "invalid_voice_session_id");
  }

  const contentType = String(req.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/sdp") {
    return errorResponse(requestId, 415, "unsupported_content_type");
  }

  const sdp = await req.text();
  if (!sdp.trim().startsWith("v=0")) {
    return errorResponse(requestId, 400, "invalid_sdp");
  }
  if (new TextEncoder().encode(sdp).byteLength > MAX_SDP_BYTES) {
    return errorResponse(requestId, 413, "sdp_too_large");
  }

  const brainsUrl = (
    process.env.BRAINS_URL || "http://172.31.32.171:8088"
  ).replace(/\/+$/, "");

  try {
    const upstream = await fetch(`${brainsUrl}/voice/realtime-preview/call`, {
      method: "POST",
      cache: "no-store",
      headers: brainsUpstreamHeaders(requestId, userId, {
        "content-type": "application/sdp",
        "x-vs-owner-user-id": userId,
        [VOICE_SESSION_HEADER]: voiceSession.value,
      }),
      body: sdp,
      signal: AbortSignal.timeout(15_000),
    });
    const body = await upstream.text().catch(() => "");
    const responseHeaders: Record<string, string> = {
      ...NO_STORE_HEADERS,
      "content-type":
        upstream.headers.get("content-type") ||
        "application/json; charset=utf-8",
      "x-request-id": upstream.headers.get("x-request-id") || requestId,
    };
    const previewSessionId = upstream.headers.get(
      "x-vs-realtime-preview-session-id",
    );
    if (previewSessionId && UUID_RE.test(previewSessionId)) {
      responseHeaders["x-vs-realtime-preview-session-id"] =
        previewSessionId.toLowerCase();
    }
    return new Response(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return errorResponse(
      requestId,
      503,
      "realtime_preview_service_unavailable",
    );
  }
}
