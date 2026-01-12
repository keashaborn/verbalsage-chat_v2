import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const user_id = String(url.searchParams.get("user_id") || "").trim();
  if (!user_id) return NextResponse.json({ error: "missing user_id" }, { status: 400 });

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";

  const r = await fetch(`${BRAINS}/threads/list/${encodeURIComponent(user_id)}`, { method: "GET" });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return NextResponse.json({ error: `brains HTTP ${r.status}`, details: txt }, { status: 502 });
  }

  const data = await r.json().catch(() => []);
  return NextResponse.json(data);
}
