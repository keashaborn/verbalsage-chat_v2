import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ version_id: string }> }
) {
  try {
    const { version_id } = await context.params;

    const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
    const url = `${BRAINS}/forms/versions/${encodeURIComponent(version_id)}`;

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
