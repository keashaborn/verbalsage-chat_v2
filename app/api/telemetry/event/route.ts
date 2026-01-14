export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  return raw || crypto.randomUUID();
}

async function getUserIdFromCookie(): Promise<string | null> {
  if (!JWKS || !process.env.SUPABASE_ISSUER) return null;

  const jar = await cookies();
  const token = jar.get("vs_at")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: process.env.SUPABASE_ISSUER });
    const uid = (payload?.sub as string) || null;
    return uid ? uid.slice(0, 128) : null;
  } catch {
    return null;
  }
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

  // Stamp request_id into each event payload (if missing)
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

  // Optional: bind telemetry to authenticated user (if available)
  const actor_user_id = await getUserIdFromCookie();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-id": requestId,
  };
  if (actor_user_id) headers["x-vs-actor-user-id"] = actor_user_id;

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
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "x-request-id": requestId,
    },
  });
}
