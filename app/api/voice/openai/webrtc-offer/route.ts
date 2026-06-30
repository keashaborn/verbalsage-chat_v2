import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireCapability } from "@/app/api/_auth/requireCapability";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  const cap = await requireCapability(req, "voice.realtime_token");
  if (!cap.ok) {
    return NextResponse.json(
      { ok: false, error: cap.msg },
      { status: cap.status, headers: { "x-request-id": requestId } }
    );
  }

  const userId = String((cap as any)?.payload?.sub || "").trim();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "x-request-id": requestId } }
    );
  }

  const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");
  const incoming = new URL(req.url);
  const upstream = new URL(`${BRAINS_URL}/voice/openai/webrtc-offer`);

  // Preserve optional model/voice/instructions query params for raw SDP calls.
  for (const key of ["model", "voice", "instructions"]) {
    const value = incoming.searchParams.get(key);
    if (value != null && value.trim()) upstream.searchParams.set(key, value.trim());
  }

  const contentType = req.headers.get("content-type") || "application/sdp";
  const body = await req.arrayBuffer();

  try {
    const r = await fetch(upstream.toString(), {
      method: "POST",
      cache: "no-store",
      headers: brainsUpstreamHeaders(requestId, userId, {
        "content-type": contentType,
      }),
      body,
    });

    const rid = r.headers.get("x-request-id") || requestId;
    const outContentType = r.headers.get("content-type") || "application/sdp";

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return new Response(text || `webrtc_offer_upstream_error:${r.status}`, {
        status: r.status,
        headers: {
          "content-type": outContentType.includes("json") ? outContentType : "text/plain; charset=utf-8",
          "x-request-id": rid,
        },
      });
    }

    const out = await r.arrayBuffer();
    return new Response(out, {
      status: 200,
      headers: {
        "content-type": outContentType,
        "x-request-id": rid,
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "brains_unreachable", detail: String(e?.message || e) },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }
}
