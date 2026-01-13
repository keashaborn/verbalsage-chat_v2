import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  const requestId = (raw || crypto.randomUUID()).slice(0, 128);

  try {
    const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";

    const qs = req.nextUrl.searchParams.toString();
    const url = `${BRAINS}/forms/entries/list${qs ? `?${qs}` : ""}`;

    const r = await fetch(url, {
      cache: "no-store",
      headers: { "x-request-id": requestId },
    });
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
