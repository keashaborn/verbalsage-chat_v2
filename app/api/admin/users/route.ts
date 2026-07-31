import { NextResponse } from "next/server";
import { getFreshSupabaseAuthContextFromRequest } from "@/app/api/_auth/supabaseUser";
import {
  hasRequiredPrivilegedAal2,
  PRIVILEGED_MFA_REQUIRED_ERROR,
  PRIVILEGED_MFA_REQUIRED_STATUS,
} from "@/app/api/_auth/privilegedMfa";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { normalizeProductTier } from "@/lib/productEntitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

type DisplayRole = "owner" | "admin" | "member";

function displayRole(raw: unknown): DisplayRole {
  if (raw === "owner" || raw === "admin") return raw;
  return "member";
}

function accountStatus(user: {
  banned_until?: string | null;
  email_confirmed_at?: string | null;
  invited_at?: string | null;
}): "active" | "invited" | "unconfirmed" | "suspended" {
  if (
    user.banned_until &&
    Number.isFinite(Date.parse(user.banned_until)) &&
    Date.parse(user.banned_until) > Date.now()
  ) {
    return "suspended";
  }
  if (user.email_confirmed_at) return "active";
  if (user.invited_at) return "invited";
  return "unconfirmed";
}

export async function GET(req: Request) {
  const auth = await getFreshSupabaseAuthContextFromRequest(req);
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }
  if (auth.role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "owner_access_required" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }
  if (!hasRequiredPrivilegedAal2(auth)) {
    return NextResponse.json(
      { ok: false, error: PRIVILEGED_MFA_REQUIRED_ERROR },
      { status: PRIVILEGED_MFA_REQUIRED_STATUS, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 100,
    });
    if (error) throw error;

    const users = data.users
      .map((user) => ({
        id: user.id,
        email: String(user.email || "").slice(0, 320),
        role: displayRole(user.app_metadata?.role),
        product_tier:
          normalizeProductTier(user.app_metadata?.product_tier) || "unassigned",
        status: accountStatus(user),
        created_at: user.created_at || null,
        last_sign_in_at: user.last_sign_in_at || null,
      }))
      .sort((a, b) => {
        const rank = { owner: 0, admin: 1, member: 2 } as const;
        return (
          rank[a.role] - rank[b.role] ||
          a.email.localeCompare(b.email, undefined, { sensitivity: "base" })
        );
      });

    return NextResponse.json(
      {
        ok: true,
        users,
        total: typeof data.total === "number" ? data.total : users.length,
        truncated: typeof data.total === "number" && data.total > users.length,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    console.error(
      JSON.stringify({
        event: "admin_user_list_failed_v1",
        actor_user_id: auth.user_id,
        at: new Date().toISOString(),
      }),
    );
    return NextResponse.json(
      { ok: false, error: "user_directory_unavailable" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
