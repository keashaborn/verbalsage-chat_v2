import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const u = new URL(req.url);

  const qs = u.searchParams.toString();
  const url = `${BRAINS_URL}/metrics/timeseries${qs ? `?${qs}` : ""}`;

  const upstream = await fetch(url, { method: "GET", cache: "no-store" });
  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
