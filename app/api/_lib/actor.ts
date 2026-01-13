import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

// Returns the *server-derived* actor_user_id for this request.
// Browser never gets to choose this.
export async function getActorUserId(): Promise<string | null> {
  // Primary: Supabase user_id from vs_at JWT
  if (JWKS && process.env.SUPABASE_ISSUER) {
    const jar = await cookies();
    const token = jar.get("vs_at")?.value;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, JWKS, { issuer: process.env.SUPABASE_ISSUER });
        const sub = (payload?.sub as string) || "";
        if (sub) return sub;
      } catch {
        // fall through
      }
    }
  }

  // Dev fallback (optional)
  const allowGuest = process.env.VS_DEV_ALLOW_GUEST === "1";
  const devTestUser = (process.env.VS_DEV_TEST_USER_ID || "").trim();
  if (allowGuest && devTestUser) return devTestUser;

  return null;
}
