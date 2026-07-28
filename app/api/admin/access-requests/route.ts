import { NextResponse } from "next/server";
import { getFreshSupabaseAuthContextFromRequest } from "@/app/api/_auth/supabaseUser";
import {
  hasRequiredPrivilegedAal2,
  PRIVILEGED_MFA_REQUIRED_ERROR,
  PRIVILEGED_MFA_REQUIRED_STATUS,
} from "@/app/api/_auth/privilegedMfa";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

type AccessRequestRow = {
  id: string;
  email: string;
  requested_name: string | null;
  request_message: string | null;
  status: "pending" | "approved" | "declined";
  request_count: number | string;
  created_at: string;
  last_requested_at: string;
  reviewed_at: string | null;
};

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
    const { data, error } = await admin
      .from("access_requests")
      .select(
        "id, email, requested_name, request_message, status, request_count, created_at, last_requested_at, reviewed_at",
      )
      .order("last_requested_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    const requests = ((data || []) as AccessRequestRow[])
      .map((request) => ({
        ...request,
        request_count: Math.max(1, Number(request.request_count) || 1),
      }))
      .sort((a, b) => {
        const rank = { pending: 0, approved: 1, declined: 2 } as const;
        return (
          rank[a.status] - rank[b.status] ||
          Date.parse(b.last_requested_at) - Date.parse(a.last_requested_at)
        );
      });

    return NextResponse.json(
      {
        ok: true,
        requests,
        pending_count: requests.filter(
          (request) => request.status === "pending",
        ).length,
        truncated: requests.length === 100,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    console.error(
      JSON.stringify({
        event: "admin_access_request_list_failed_v1",
        actor_user_id: auth.user_id,
        at: new Date().toISOString(),
      }),
    );
    return NextResponse.json(
      { ok: false, error: "access_request_directory_unavailable" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
