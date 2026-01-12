import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

export async function requireAdmin() {
  if (!JWKS || !process.env.SUPABASE_ISSUER) {
    return { ok: false, status: 500, msg: "JWKS not configured" as const };
  }

  const jar = await cookies();
  const token = jar.get("vs_at")?.value;
  if (!token) return { ok: false, status: 401, msg: "missing auth token" as const };

  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: process.env.SUPABASE_ISSUER });
    const role = (payload as any)?.app_metadata?.role;
    if (role !== "admin") return { ok: false, status: 403, msg: "admin required" as const };
    return { ok: true, status: 200, payload };
  } catch {
    return { ok: false, status: 401, msg: "invalid token" as const };
  }
}
