export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookieSecure } from "@/lib/cookieSecure";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { randomUUID } from "crypto";

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

export async function DELETE(req: Request) {
  const requestId = getRequestId(req);

  if (process.env.VS_ALLOW_DELETE_ALL !== "true") {
    return NextResponse.json({ error: "delete_all disabled" }, { status: 403, headers: { "x-request-id": requestId } });
  }

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const user_id = (await getUserIdFromCookie()) || null;
  if (!user_id) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });

  const r = await fetch(`${BRAINS}/user/${encodeURIComponent(user_id)}/data`, {
    method: "DELETE",
    headers: { "x-request-id": requestId },
    cache: "no-store",
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    return NextResponse.json(
      { error: `brains HTTP ${r.status}`, details: txt },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }

  // Clear active thread cookie so UI doesn't point at deleted data
  const res = new NextResponse(txt, {
    status: 200,
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
  });

  const secure = await cookieSecure();
  res.cookies.set("vs_tid", "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
