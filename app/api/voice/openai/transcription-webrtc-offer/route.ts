import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireCapability } from "@/app/api/_auth/requireCapability";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SDP_BYTES = 128 * 1024;

function getRequestId(req: Request): string {
  const raw = (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    ""
  ).trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const capability = await requireCapability(req, "voice.realtime_token");
  if (!capability.ok) {
    return NextResponse.json(
      { ok: false, error: capability.msg },
      { status: capability.status, headers: { "x-request-id": requestId } },
    );
  }

  const userId = String((capability as any)?.payload?.sub || "").trim();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  const contentType = String(req.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/sdp") {
    return NextResponse.json(
      { ok: false, error: "unsupported_content_type" },
      { status: 415, headers: { "x-request-id": requestId } },
    );
  }

  const sdp = await req.text();
  if (!sdp.trim()) {
    return NextResponse.json(
      { ok: false, error: "missing_sdp" },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }
  if (Buffer.byteLength(sdp, "utf8") > MAX_SDP_BYTES) {
    return NextResponse.json(
      { ok: false, error: "sdp_too_large" },
      { status: 413, headers: { "x-request-id": requestId } },
    );
  }

  const brainsUrl = (
    process.env.BRAINS_URL || "http://172.31.32.171:8088"
  ).replace(/\/+$/, "");

  try {
    const upstream = await fetch(
      `${brainsUrl}/voice/openai/transcription-webrtc-offer`,
      {
        method: "POST",
        cache: "no-store",
        headers: brainsUpstreamHeaders(requestId, userId, {
          "content-type": "application/sdp",
          "x-vs-owner-user-id": userId,
        }),
        body: sdp,
      },
    );

    const responseBody = await upstream.text().catch(() => "");
    const upstreamRequestId = upstream.headers.get("x-request-id") || requestId;
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ||
          (upstream.ok ? "application/sdp" : "application/json; charset=utf-8"),
        "cache-control": "no-store",
        "x-request-id": upstreamRequestId,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "brains_unreachable",
        detail: String(error?.message || error),
      },
      { status: 502, headers: { "x-request-id": requestId } },
    );
  }
}
