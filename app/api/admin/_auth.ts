import { getSupabaseAuthContextFromRequest } from "@/app/api/_auth/supabaseUser";

export async function getSupabasePayloadFromRequest(req?: Request): Promise<any | null> {
  if (!req) return null;
  const auth = await getSupabaseAuthContextFromRequest(req);
  return auth?.payload || null;
}

export async function requireAdmin(req?: Request) {
  if (!req) {
    return { ok: false, status: 401, msg: "missing request" as const };
  }

  const auth = await getSupabaseAuthContextFromRequest(req);
  if (!auth) {
    return { ok: false, status: 401, msg: "missing or invalid auth token" as const };
  }

  if (!auth.is_admin) {
    return { ok: false, status: 403, msg: "admin required" as const };
  }

  return { ok: true, status: 200, payload: auth.payload, auth };
}
