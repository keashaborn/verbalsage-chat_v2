export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { randomUUID } from "crypto";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}

async function getUserIdFromCookie(): Promise<string | null> {
  if (!JWKS || !process.env.SUPABASE_ISSUER) return null;

  const jar = await cookies();
  const token = jar.get("vs_at")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: process.env.SUPABASE_ISSUER });
    return (payload?.sub as string) || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ thread_id: string }> }) {
  const requestId = getRequestId(req);

  const _user_id = (await getUserIdFromCookie()) || null;
  if (!_user_id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });
  }

  const { thread_id } = await context.params;
  const tid = String(thread_id || "").trim();
  if (!tid) {
    return NextResponse.json({ error: "missing thread_id" }, { status: 400, headers: { "x-request-id": requestId } });
  }
  if (!UUID_RE.test(tid)) {
    return NextResponse.json({ error: "invalid thread_id" }, { status: 400, headers: { "x-request-id": requestId } });
  }

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "missing title" }, { status: 400, headers: { "x-request-id": requestId } });
  }

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";

  const r = await fetch(`${BRAINS}/threads/${encodeURIComponent(tid)}/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({ title }),
    cache: "no-store",
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    return NextResponse.json(
      { error: `brains HTTP ${r.status}`, details: txt },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }

  return new Response(txt, {
    status: 200,
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
  });
}
