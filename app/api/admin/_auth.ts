import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

const ISSUER = process.env.SUPABASE_ISSUER;

export async function getSupabasePayloadFromRequest(req?: Request): Promise<any | null> {
  if (!JWKS || !ISSUER || !req) return null;

  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER });
    return payload;
  } catch {
    return null;
  }
}

export async function requireAdmin(req?: Request) {
  if (!JWKS || !ISSUER) {
    return { ok: false, status: 500, msg: "JWKS not configured" as const };
  }

  const payload = await getSupabasePayloadFromRequest(req);
  if (!payload) return { ok: false, status: 401, msg: "missing or invalid auth token" as const };

  const role = (payload as any)?.app_metadata?.role;
  if (role !== "admin") return { ok: false, status: 403, msg: "admin required" as const };

  return { ok: true, status: 200, payload };
}
