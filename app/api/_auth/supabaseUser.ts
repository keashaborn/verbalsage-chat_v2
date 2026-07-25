import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

const ISSUER = process.env.SUPABASE_ISSUER;

type SupabaseJwtPayload = JWTPayload & {
  sub: string;
  role: "authenticated";
  session_id: string;
  is_anonymous?: boolean;
  app_metadata?: Record<string, unknown>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bearerToken(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  const token = auth.slice(7).trim();
  if (
    !token ||
    token.length > 16_384 ||
    [...token].some((char) => /\s/.test(char))
  ) {
    return "";
  }
  return token;
}

export function getSupabaseBearerAuthorizationFromRequest(
  req: Request,
): string | null {
  const token = bearerToken(req);
  return token ? `Bearer ${token}` : null;
}

function supabaseAuthEndpoint(): { url: string; apiKey: string } | null {
  const rawUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const apiKey = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  ).trim();
  if (!rawUrl || !apiKey) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return null;
    }
    parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/auth/v1/user`;
    parsed.search = "";
    parsed.hash = "";
    return { url: parsed.toString(), apiKey };
  } catch {
    return null;
  }
}

async function verifiedSupabasePayload(req: Request): Promise<SupabaseJwtPayload | null> {
  if (!JWKS || !ISSUER) return null;

  const token = bearerToken(req);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: "authenticated",
    });
    if (
      typeof payload.sub !== "string" ||
      !UUID_PATTERN.test(payload.sub) ||
      payload.role !== "authenticated" ||
      typeof payload.session_id !== "string" ||
      !UUID_PATTERN.test(payload.session_id) ||
      payload.is_anonymous === true
    ) {
      return null;
    }
    return payload as SupabaseJwtPayload;
  } catch {
    return null;
  }
}

export async function getSupabaseUserIdFromRequest(req: Request): Promise<string | null> {
  const payload = await verifiedSupabasePayload(req);
  return payload?.sub || null;
}

export type SupabaseRequestAuth = {
  user_id: string;
  role: string | null;
  is_admin: boolean;
  payload: SupabaseJwtPayload;
};

export async function getSupabasePayloadFromRequest(
  req: Request,
): Promise<SupabaseJwtPayload | null> {
  return await verifiedSupabasePayload(req);
}

export async function getSupabaseAuthContextFromRequest(req: Request): Promise<SupabaseRequestAuth | null> {
  const payload = await getSupabasePayloadFromRequest(req);
  if (!payload) return null;
  const user_id = payload.sub;

  const appRole = payload.app_metadata?.role;
  const role = typeof appRole === "string" ? appRole : null;

  return {
    user_id,
    role,
    is_admin: role === "admin",
    payload,
  };
}

export async function getFreshSupabaseAuthContextFromRequest(
  req: Request,
): Promise<SupabaseRequestAuth | null> {
  const payload = await verifiedSupabasePayload(req);
  const token = bearerToken(req);
  const endpoint = supabaseAuthEndpoint();
  if (!payload || !token || !endpoint) return null;

  try {
    const response = await fetch(endpoint.url, {
      method: "GET",
      headers: {
        apikey: endpoint.apiKey,
        authorization: `Bearer ${token}`,
        accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const raw = await response.text();
    if (!raw || raw.length > 65_536) return null;
    const user = JSON.parse(raw);
    if (
      !user ||
      typeof user !== "object" ||
      String(user.id || "") !== payload.sub
    ) {
      return null;
    }
    const appRole = user.app_metadata?.role;
    const role = typeof appRole === "string" ? appRole : null;
    return {
      user_id: payload.sub,
      role,
      is_admin: role === "admin",
      payload,
    };
  } catch {
    return null;
  }
}
