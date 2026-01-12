export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

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

export async function POST(req: Request) {
  const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";

  const user_id = await getUserIdFromCookie();
  if (!user_id) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { }

  const full_name = String(body?.full_name || "").trim();
  const email = String(body?.email || "").trim();
  const name = full_name || email;
  if (!name) return Response.json({ error: "missing name" }, { status: 400 });

  // idempotent: if already exists, do nothing
  const existing = await fetch(`${BRAINS_URL}/cards/${encodeURIComponent(user_id)}?kinds=user_identity&limit=1`);
  if (existing.ok) {
    const j = await existing.json().catch(() => null);
    if (j?.count && j.count > 0) return Response.json({ status: "exists" });
  }

  const r = await fetch(`${BRAINS_URL}/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id,
      source: "frontend/identity",
      text: `FULL_NAME:${name}`,
      tags: ["identity"],
    }),
  });

  const t = await r.text().catch(() => "");
  if (!r.ok) return new Response(t || "brains error", { status: 502 });
  return Response.json({ status: "ok" });
}
