import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const runtime = "nodejs";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

export async function GET(req: Request) {
  if (!JWKS || !process.env.SUPABASE_ISSUER) {
    return NextResponse.json({ ok: false, error: "JWKS not configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization") || "";
  let token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";

  // Temporary legacy fallback while LifeSwitch/admin routes are being migrated.
  if (!token) {
    const jar = await cookies();
    token = jar.get("vs_at")?.value || "";
  }

  if (!token) return NextResponse.json({ ok: false, error: "no auth token" }, { status: 401 });

  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: process.env.SUPABASE_ISSUER });

    return NextResponse.json({
      ok: true,
      sub: payload.sub,
      email: (payload as any).email || null,
      role: (payload as any)?.app_metadata?.role || null,
      app_metadata: (payload as any)?.app_metadata || null,
      user_metadata: (payload as any)?.user_metadata || null,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid token" }, { status: 401 });
  }
}
