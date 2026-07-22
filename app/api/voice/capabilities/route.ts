import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  try {
    const userId = await getSupabaseUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: { "x-request-id": requestId } },
      );
    }

    const brainsUrl = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");
    const upstream = await fetch(`${brainsUrl}/voice/capabilities`, {
      method: "GET",
      cache: "no-store",
      headers: brainsUpstreamHeaders(requestId, userId),
    });

    const body = await upstream.text().catch(() => "");
    const upstreamRequestId = upstream.headers.get("x-request-id") || requestId;

    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-request-id": upstreamRequestId,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "voice_capabilities_unavailable" },
      { status: 502, headers: { "x-request-id": requestId } },
    );
  }
}
