import type { SupabaseRequestAuth } from "./supabaseUser";

export const PRIVILEGED_MFA_REQUIRED_STATUS = 428;
export const PRIVILEGED_MFA_REQUIRED_ERROR = "mfa_verification_required";

export function hasRequiredPrivilegedAal2(
  auth: Pick<SupabaseRequestAuth, "role" | "payload">,
): boolean {
  if (auth.role !== "owner" && auth.role !== "admin") {
    return true;
  }

  return auth.payload.aal === "aal2";
}
