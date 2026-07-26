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

type RequestedRole = "admin" | "member";
type DisplayRole = "owner" | "admin" | "member";

function displayRole(raw: unknown): DisplayRole {
  if (raw === "owner" || raw === "admin") return raw;
  return "member";
}

function requestId(req: Request): string {
  const raw = String(
    req.headers.get("x-request-id") ||
      req.headers.get("x-correlation-id") ||
      "",
  ).trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

async function requestedRole(req: Request): Promise<RequestedRole | null> {
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
      (body.role !== "admin" && body.role !== "member")
    ) {
      return null;
    }
    return body.role;
  } catch {
    return null;
  }
}

export async function PATCH(
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

  const role = await requestedRole(req);
  if (!role) {
    return NextResponse.json(
      { ok: false, error: "invalid_role_request" },
      { status: 400, headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
    );
  }

  try {
    const admin = getSupabaseAdminClient();
    const { data: currentData, error: currentError } =
      await admin.auth.admin.getUserById(userId);
    if (currentError || !currentData.user) {
      return NextResponse.json(
        { ok: false, error: "user_not_found" },
        { status: 404, headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
      );
    }

    const currentRole = displayRole(currentData.user.app_metadata?.role);
    if (userId === auth.user_id || currentRole === "owner") {
      return NextResponse.json(
        { ok: false, error: "owner_account_is_protected" },
        { status: 409, headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
      );
    }

    if (currentRole === role) {
      return NextResponse.json(
        { ok: true, changed: false, user_id: userId, role },
        { headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
      );
    }

    const existingMetadata =
      currentData.user.app_metadata &&
      typeof currentData.user.app_metadata === "object" &&
      !Array.isArray(currentData.user.app_metadata)
        ? currentData.user.app_metadata
        : {};
    const storedRole = role === "admin" ? "admin" : "user";

    const { data: updatedData, error: updateError } =
      await admin.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...existingMetadata,
          role: storedRole,
        },
      });
    if (updateError || !updatedData.user) throw updateError || new Error();
    if (displayRole(updatedData.user.app_metadata?.role) !== role) {
      throw new Error("role verification failed");
    }

    console.info(
      JSON.stringify({
        event: "admin_role_change_v1",
        request_id: id,
        actor_user_id: auth.user_id,
        target_user_id: userId,
        previous_role: currentRole,
        new_role: role,
        authorization_effect: "immediate_on_next_request",
        at: new Date().toISOString(),
      }),
    );

    return NextResponse.json(
      { ok: true, changed: true, user_id: userId, role },
      { headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
    );
  } catch {
    console.error(
      JSON.stringify({
        event: "admin_role_change_failed_v1",
        request_id: id,
        actor_user_id: auth.user_id,
        target_user_id: userId,
        requested_role: role,
        at: new Date().toISOString(),
      }),
    );
    return NextResponse.json(
      { ok: false, error: "role_change_failed" },
      { status: 503, headers: { ...NO_STORE_HEADERS, "x-request-id": id } },
    );
  }
}
