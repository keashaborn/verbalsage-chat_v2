export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  // Use incoming id if present; else mint one.
  return raw || crypto.randomUUID();
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const url = `${BRAINS_URL}/telemetry/event`;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Defense-in-depth: stamp request_id into each event payload (if missing)
  // so Postgres has it even if upstream middleware changes.
  try {
    const events = Array.isArray(body?.events) ? body.events : null;
    if (events) {
      for (const e of events) {
        if (!e || typeof e !== "object") continue;
        if (!e.payload || typeof e.payload !== "object") e.payload = {};
        if (!("request_id" in e.payload)) e.payload.request_id = requestId;
      }
    }
  } catch {
    // ignore
  }

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "x-request-id": requestId,
    },
  });
}
