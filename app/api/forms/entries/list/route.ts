import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";

    const qs = req.nextUrl.searchParams.toString();
    const url = `${BRAINS}/forms/entries/list${qs ? `?${qs}` : ""}`;

    const r = await fetch(url, { cache: "no-store" });
    const text = await r.text();

    return new NextResponse(text, {
      status: r.status,
      headers: { "Content-Type": r.headers.get("content-type") || "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
