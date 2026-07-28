import { NextResponse } from "next/server";
import { getFreshSupabaseAuthContextFromRequest } from "@/app/api/_auth/supabaseUser";
import {
  hasRequiredPrivilegedAal2,
  PRIVILEGED_MFA_REQUIRED_ERROR,
  PRIVILEGED_MFA_REQUIRED_STATUS,
} from "@/app/api/_auth/privilegedMfa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: Request) {
  const auth = await getFreshSupabaseAuthContextFromRequest(req);
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  if (auth.role !== "owner" && auth.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "admin_access_required" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }
  if (!hasRequiredPrivilegedAal2(auth)) {
    return NextResponse.json(
      { ok: false, error: PRIVILEGED_MFA_REQUIRED_ERROR },
      { status: PRIVILEGED_MFA_REQUIRED_STATUS, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      user_id: auth.user_id,
      role: auth.role,
      role_label: auth.role === "owner" ? "Owner" : "Admin",
    },
    { headers: NO_STORE_HEADERS },
  );
}
