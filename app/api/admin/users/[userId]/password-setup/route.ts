import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getFreshSupabaseAuthContextFromRequest } from "@/app/api/_auth/supabaseUser";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestId(req: Request): string {
  const raw = String(
    req.headers.get("x-request-id") ||
      req.headers.get("x-correlation-id") ||
      "",
  ).trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

function passwordSetupRedirectUrl(): string {
  const configured = String(
    process.env.ACCESS_INVITE_REDIRECT_URL ||
      "https://verbalsage.com/auth/accept-invite",
  ).trim();
  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      throw new Error("invalid redirect");
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "https://verbalsage.com/auth/accept-invite";
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const id = requestId(req);
  const auth = await getFreshSupabaseAuthContextFromRequest(req);
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
    );
  }
  if (auth.role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "owner_access_required" },
      { status: 403, headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
    );
  }

  const { userId } = await context.params;
  if (!UUID_PATTERN.test(userId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_user_id" },
      { status: 400, headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
    );
  }

  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) {
      return NextResponse.json(
        { ok: false, error: "user_not_found" },
        { status: 404, headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
      );
    }

    const targetRole = data.user.app_metadata?.role;
    if (userId === auth.user_id || targetRole === "owner") {
      return NextResponse.json(
        { ok: false, error: "owner_account_is_protected" },
        { status: 409, headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
      );
    }

    const targetEmail = String(data.user.email || "").trim();
    if (!targetEmail) {
      return NextResponse.json(
        { ok: false, error: "user_email_unavailable" },
        { status: 409, headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
      );
    }

    const { error: resetError } = await admin.auth.resetPasswordForEmail(
      targetEmail,
      { redirectTo: passwordSetupRedirectUrl() },
    );
    if (resetError) throw resetError;

    console.info(
      JSON.stringify({
        event: "admin_password_setup_email_v1",
        request_id: id,
        actor_user_id: auth.user_id,
        target_user_id: userId,
        at: new Date().toISOString(),
      }),
    );

    return NextResponse.json(
      { ok: true, sent: true, user_id: userId },
      { headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
    );
  } catch {
    console.error(
      JSON.stringify({
        event: "admin_password_setup_email_failed_v1",
        request_id: id,
        actor_user_id: auth.user_id,
        target_user_id: userId,
        at: new Date().toISOString(),
      }),
    );
    return NextResponse.json(
      { ok: false, error: "password_setup_email_failed" },
      { status: 503, headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
    );
  }
}
