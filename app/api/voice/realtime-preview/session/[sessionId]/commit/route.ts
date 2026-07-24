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

export async function POST(
  req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
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
  const { sessionId: rawSessionId } = await context.params;
  const previewSessionId = String(rawSessionId || "")
    .trim()
    .toLowerCase();
  const voiceSession = voiceSessionIdFromRequest(req);
  if (
    !UUID_RE.test(userId) ||
    !UUID_RE.test(previewSessionId) ||
    !voiceSession.supplied ||
    !voiceSession.value
  ) {
    return errorResponse(requestId, 400, "invalid_session_id");
  }

  const brainsUrl = (
    process.env.BRAINS_URL || "http://172.31.32.171:8088"
  ).replace(/\/+$/, "");

  try {
    const upstream = await fetch(
      `${brainsUrl}/voice/realtime-preview/session/${previewSessionId}/commit`,
      {
        method: "POST",
        cache: "no-store",
        headers: brainsUpstreamHeaders(requestId, userId, {
          "content-type": "application/json",
          "x-vs-owner-user-id": userId,
          [VOICE_SESSION_HEADER]: voiceSession.value,
        }),
        body: "{}",
        signal: AbortSignal.timeout(10_000),
      },
    );
    const body = await upstream.text().catch(() => "");
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...NO_STORE_HEADERS,
        "content-type":
          upstream.headers.get("content-type") ||
          "application/json; charset=utf-8",
        "x-request-id": upstream.headers.get("x-request-id") || requestId,
      },
    });
  } catch {
    return errorResponse(
      requestId,
      503,
      "realtime_preview_service_unavailable",
    );
  }
}
