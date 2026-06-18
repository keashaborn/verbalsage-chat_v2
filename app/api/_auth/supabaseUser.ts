import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

const ISSUER = process.env.SUPABASE_ISSUER;

export async function getSupabaseUserIdFromRequest(req: Request): Promise<string | null> {
  if (!JWKS || !ISSUER) return null;

  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER });
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}
