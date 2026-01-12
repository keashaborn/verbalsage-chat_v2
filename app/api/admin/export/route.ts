import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


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

export async function GET(req: Request) {
  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const user_id = (await getUserIdFromCookie()) || null;
  if (!user_id) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

  const url = new URL(req.url);
  const limit = String(url.searchParams.get("limit") || "20000");

  const upstream = await fetch(`${BRAINS}/user/${encodeURIComponent(user_id)}/export?limit=${encodeURIComponent(limit)}`, {
    method: "GET",
  });

  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    return new Response(txt || `Brains HTTP ${upstream.status}`, { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") || "application/json");
  const cd = upstream.headers.get("content-disposition");
  if (cd) headers.set("Content-Disposition", cd);

  return new Response(upstream.body, { status: 200, headers });
}
