export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getActorUserId } from "../../_lib/actor";

export async function POST(req: Request) {
  const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const url = `${BRAINS_URL}/telemetry/event`;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const actor = await getActorUserId();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (actor) headers["x-vs-actor-user-id"] = actor;

  const upstream = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
