export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { randomUUID } from "crypto";
import { cookieSecure } from "@/lib/cookieSecure";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

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

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const user_id = (await getUserIdFromCookie()) || null;
  if (!user_id) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });

  const r = await fetch(`${BRAINS}/threads/list/${encodeURIComponent(user_id)}`, {
    method: "GET",
    headers: { "x-request-id": requestId, Accept: "application/json" },
    cache: "no-store",
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    return NextResponse.json(
      { error: `brains HTTP ${r.status}`, details: txt },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }

  return new NextResponse(txt, {
    status: 200,
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
  });
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const user_id = (await getUserIdFromCookie()) || null;
  if (!user_id) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "New chat").trim() || "New chat";

  const r = await fetch(`${BRAINS}/threads/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({ user_id, title }),
    cache: "no-store",
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    return NextResponse.json(
      { error: `brains HTTP ${r.status}`, details: txt },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }

  let data: any = {};
  try {
    data = JSON.parse(txt);
  } catch { }
  const thread_id = String(data?.thread_id || "").trim();

  const res = new NextResponse(txt, {
    status: 200,
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
  });

  if (thread_id) {
    res.cookies.set("vs_tid", thread_id, {
      httpOnly: true,
      secure: await cookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return res;
}
