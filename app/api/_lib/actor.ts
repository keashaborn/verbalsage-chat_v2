import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";

// Returns the server-derived actor_user_id for this request.
// Browser never gets to choose this.
export async function getActorUserId(req?: Request): Promise<string | null> {
  if (req) {
    const uid = await getSupabaseUserIdFromRequest(req);
    if (uid) return uid;
  }

  // Dev fallback only. No browser identity cookie fallback.
  const allowGuest = process.env.VS_DEV_ALLOW_GUEST === "1";
  const devTestUser = (process.env.VS_DEV_TEST_USER_ID || "").trim();
  if (allowGuest && devTestUser) return devTestUser;

  return null;
}
