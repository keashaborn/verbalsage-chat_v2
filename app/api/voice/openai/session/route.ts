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

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    body = {};
  }

  const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");
  const url = `${BRAINS_URL}/voice/openai/session`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: brainsUpstreamHeaders(requestId, userId, {
        "content-type": "application/json; charset=utf-8",
      }),
      body: JSON.stringify(body),
    });

    const text = await upstream.text().catch(() => "");
    const rid = upstream.headers.get("x-request-id") || requestId;

    return new Response(text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "x-request-id": rid,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "brains_unreachable", detail: String(e?.message || e) },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }
}
