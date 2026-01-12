export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { requireAdmin } from "../_auth";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

async function requireUserOrDevFallback(): Promise<string | null> {
  // Primary: Supabase session if configured
  if (JWKS && process.env.SUPABASE_ISSUER) {
    const jar = await cookies();
    const token = jar.get("vs_at")?.value;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, JWKS, { issuer: process.env.SUPABASE_ISSUER });
        const uid = (payload?.sub as string) || null;
        if (uid) return uid;
      } catch {
        // fall through
      }
    }
  }

  // Dev escape hatch (mirror /api/chat)
  const allowGuest = process.env.VS_DEV_ALLOW_GUEST === "1";
  const devTestUser = (process.env.VS_DEV_TEST_USER_ID || "").trim();
  if (allowGuest && devTestUser) return devTestUser;

  return null;
}

export async function POST(_req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return new Response(auth.msg, { status: auth.status });

  const uid = await requireUserOrDevFallback();
  if (!uid) return new Response("unauthorized", { status: 401 });

  const secret = (process.env.VS_DEBUG_TOKEN || "").trim();
  if (!secret) return new Response("VS_DEBUG_TOKEN not set", { status: 500 });

  const jar = await cookies();
  jar.set("vs_debug_token", secret, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 6,
  });

  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
