import { randomUUID } from "crypto";
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

async function confirmedEmail(req: Request): Promise<string | null> {
  const declaredLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > 1_024) return null;

  const raw = await req.text();
  if (!raw || raw.length > 1_024) return null;

  try {
    const body = JSON.parse(raw);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      typeof body.confirmation_email !== "string"
    ) {
      return null;
    }
    const email = body.confirmation_email.trim();
    return email && email.length <= 320 ? email : null;
  } catch {
    return null;
  }
}

export async function DELETE(
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
  if (!hasRequiredPrivilegedAal2(auth)) {
    return NextResponse.json(
      { ok: false, error: PRIVILEGED_MFA_REQUIRED_ERROR },
      {
        status: PRIVILEGED_MFA_REQUIRED_STATUS,
        headers: { ...NO_STORE_HEADERS, "x-request-id": id },
      },
    );
  }

  const { userId } = await context.params;
  if (!UUID_PATTERN.test(userId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_user_id" },
      { status: 400, headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
    );
  }

  const confirmationEmail = await confirmedEmail(req);
  if (!confirmationEmail) {
    return NextResponse.json(
      { ok: false, error: "confirmation_email_required" },
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
    if (
      !targetEmail ||
      confirmationEmail.toLowerCase() !== targetEmail.toLowerCase()
    ) {
      return NextResponse.json(
        { ok: false, error: "confirmation_email_mismatch" },
        { status: 409, headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
      );
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    console.info(
      JSON.stringify({
        event: "admin_user_delete_v1",
        request_id: id,
        actor_user_id: auth.user_id,
        target_user_id: userId,
        deleted_resource: "supabase_auth_identity",
        retained_resources: ["conversations", "memory_data"],
        at: new Date().toISOString(),
      }),
    );

    return NextResponse.json(
      {
        ok: true,
        deleted: true,
        user_id: userId,
        retained_resources: ["conversations", "memory_data"],
      },
      { headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
    );
  } catch {
    console.error(
      JSON.stringify({
        event: "admin_user_delete_failed_v1",
        request_id: id,
        actor_user_id: auth.user_id,
        target_user_id: userId,
        at: new Date().toISOString(),
      }),
    );
    return NextResponse.json(
      { ok: false, error: "account_deletion_failed" },
      { status: 503, headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
    );
  }
}
