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

export type SupabaseRequestAuth = {
  user_id: string;
  role: string | null;
  is_admin: boolean;
  payload: any;
};

export async function getSupabasePayloadFromRequest(req: Request): Promise<any | null> {
  if (!JWKS || !ISSUER) return null;

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

export async function getSupabaseAuthContextFromRequest(req: Request): Promise<SupabaseRequestAuth | null> {
  const payload = await getSupabasePayloadFromRequest(req);
  const user_id = (payload?.sub as string) || "";
  if (!user_id) return null;

  const role = (payload as any)?.app_metadata?.role ?? null;

  return {
    user_id,
    role,
    is_admin: role === "admin",
    payload,
  };
}

