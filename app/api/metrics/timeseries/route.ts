export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getActorUserId } from "../../_lib/actor";

export async function GET(req: Request) {
  const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const u = new URL(req.url);
  const qs = u.searchParams.toString();
  const url = `${BRAINS_URL}/metrics/timeseries${qs ? `?${qs}` : ""}`;

  const actor = await getActorUserId();
  const headers: Record<string, string> = {};
  if (actor) headers["x-vs-actor-user-id"] = actor;

  const upstream = await fetch(url, { method: "GET", cache: "no-store", headers });
  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
