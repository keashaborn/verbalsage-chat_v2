import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";

// Compatibility export name. This no longer reads cookies.
export async function getActorUserIdFromCookie(req?: Request): Promise<string | null> {
  if (!req) return null;
  return await getSupabaseUserIdFromRequest(req);
}

export async function getActorUserIdFromRequest(req: Request): Promise<string | null> {
  return await getSupabaseUserIdFromRequest(req);
}
