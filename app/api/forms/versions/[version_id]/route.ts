import { NextRequest, NextResponse } from "next/server";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import { getFreshLifeSwitchUserIdFromRequest } from "@/app/api/_auth/productAccess";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ version_id: string }> }
) {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  const requestId = (raw || crypto.randomUUID()).slice(0, 128);
  const userId = await getFreshLifeSwitchUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  try {
    const { version_id } = await context.params;

    const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
    const url = `${BRAINS}/forms/versions/${encodeURIComponent(version_id)}`;

    const r = await fetch(url, { cache: "no-store", headers: brainsUpstreamHeaders(requestId, userId) });
    const text = await r.text();

    const rid = r.headers.get("x-request-id") || requestId;

    return new NextResponse(text, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") || "application/json",
        "x-request-id": rid,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 500, headers: { "x-request-id": requestId } }
    );
  }
}
