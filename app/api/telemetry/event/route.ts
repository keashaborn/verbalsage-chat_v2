export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  return raw || crypto.randomUUID();
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const actor_user_id = await getSupabaseUserIdFromRequest(req);
  if (!actor_user_id) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      {
        status: 401,
        headers: { ...NO_STORE_HEADERS, "x-request-id": requestId },
      },
    );
  }

  const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const url = `${BRAINS_URL}/telemetry/event`;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Stamp request_id into each event payload if missing.
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

  const headers = brainsUpstreamHeaders(
    requestId,
    actor_user_id,
    { "Content-Type": "application/json" }
  );

  const upstream = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "x-request-id": requestId,
    },
  });
}
