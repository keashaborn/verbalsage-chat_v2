import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requireCapability } from "@/app/api/_auth/requireCapability";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["acquire", "heartbeat", "release"]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: Request,
  context: { params: Promise<{ action: string }> },
) {
  const requestId = randomUUID();
  const { action } = await context.params;
  if (!ACTIONS.has(action)) {
    return NextResponse.json(
      { ok: false, error: "unknown_voice_session_action" },
      { status: 404, headers: { "x-request-id": requestId } },
    );
  }

  const capability = await requireCapability(req, "voice.transcription");
  if (!capability.ok) {
    return NextResponse.json(
      { ok: false, error: capability.msg },
      {
        status: capability.status,
        headers: { "x-request-id": requestId },
      },
    );
  }

  const userId = String((capability as any)?.payload?.sub || "").trim();
  if (!UUID_RE.test(userId)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const sessionId = String(body?.session_id || "").trim().toLowerCase();
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_voice_session_id" },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  const brainsUrl = (
    process.env.BRAINS_URL || "http://172.31.32.171:8088"
  ).replace(/\/+$/, "");

  try {
    const upstream = await fetch(`${brainsUrl}/voice/session/${action}`, {
      method: "POST",
      cache: "no-store",
      headers: brainsUpstreamHeaders(requestId, userId, {
        "content-type": "application/json; charset=utf-8",
        "x-vs-owner-user-id": userId,
      }),
      body: JSON.stringify({ session_id: sessionId }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await upstream.text().catch(() => "");
    return new Response(payload, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ||
          "application/json; charset=utf-8",
        "cache-control": "private, no-store, max-age=0, must-revalidate",
        pragma: "no-cache",
        expires: "0",
        "x-request-id":
          upstream.headers.get("x-request-id") || requestId,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "voice_session_service_unavailable" },
      {
        status: 503,
        headers: {
          "cache-control": "private, no-store, max-age=0, must-revalidate",
          "x-request-id": requestId,
        },
      },
    );
  }
}
