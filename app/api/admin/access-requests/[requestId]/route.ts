import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getFreshSupabaseAuthContextFromRequest } from "@/app/api/_auth/supabaseUser";
import {
  hasRequiredPrivilegedAal2,
  PRIVILEGED_MFA_REQUIRED_ERROR,
  PRIVILEGED_MFA_REQUIRED_STATUS,
} from "@/app/api/_auth/privilegedMfa";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { accessInviteRedirectUrl } from "@/lib/accessInviteRedirect";
import {
  normalizeProductTier,
  type ProductTier,
} from "@/lib/productEntitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Decision = "approve" | "decline";
type DecisionRequest = {
  decision: Decision;
  productTier: ProductTier | null;
};
type AccessRequestRow = {
  id: string;
  email: string;
  requested_name: string | null;
  status: "pending" | "approved" | "declined";
};

function requestId(req: Request): string {
  const raw = String(
    req.headers.get("x-request-id") ||
      req.headers.get("x-correlation-id") ||
      "",
  ).trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

async function requestedDecision(req: Request): Promise<DecisionRequest | null> {
  const declaredLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > 1_024) return null;

  const raw = await req.text();
  if (!raw || raw.length > 1_024) return null;
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    if (body.decision === "decline") {
      return Object.keys(body).length === 1
        ? { decision: "decline", productTier: null }
        : null;
    }
    const productTier = normalizeProductTier(body.product_tier);
    if (
      body.decision !== "approve" ||
      Object.keys(body).length !== 2 ||
      !productTier
    ) {
      return null;
    }
    return { decision: "approve", productTier };
  } catch {
    return null;
  }
}

async function findUserByEmail(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  email: string,
) {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });
  if (error) throw error;
  return (
    data.users.find(
      (user) => String(user.email || "").trim().toLowerCase() === normalized,
    ) || null
  );
}

async function assignProductTier(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  user: { id: string; app_metadata?: Record<string, unknown> },
  productTier: ProductTier,
) {
  const existingMetadata =
    user.app_metadata &&
    typeof user.app_metadata === "object" &&
    !Array.isArray(user.app_metadata)
      ? user.app_metadata
      : {};
  if (
    String(existingMetadata.role || "").trim() === "owner" &&
    productTier !== "lifeswitch"
  ) {
    throw new Error("owner product tier is protected");
  }
  const role = String(existingMetadata.role || "").trim() || "user";
  const { data, error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...existingMetadata,
      role,
      product_tier: productTier,
    },
  });
  if (error || !data.user) throw error || new Error("user update failed");
  if (
    normalizeProductTier(data.user.app_metadata?.product_tier) !== productTier
  ) {
    throw new Error("product tier verification failed");
  }
  return data.user;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const auditId = requestId(req);
  const auth = await getFreshSupabaseAuthContextFromRequest(req);
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      {
        status: 401,
        headers: { ...NO_STORE_HEADERS, "x-request-id": auditId },
      },
    );
  }
  if (auth.role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "owner_access_required" },
      {
        status: 403,
        headers: { ...NO_STORE_HEADERS, "x-request-id": auditId },
      },
    );
  }
  if (!hasRequiredPrivilegedAal2(auth)) {
    return NextResponse.json(
      { ok: false, error: PRIVILEGED_MFA_REQUIRED_ERROR },
      {
        status: PRIVILEGED_MFA_REQUIRED_STATUS,
        headers: { ...NO_STORE_HEADERS, "x-request-id": auditId },
      },
    );
  }

  const { requestId: accessRequestId } = await context.params;
  if (!UUID_PATTERN.test(accessRequestId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_request_id" },
      {
        status: 400,
        headers: { ...NO_STORE_HEADERS, "x-request-id": auditId },
      },
    );
  }

  const requested = await requestedDecision(req);
  if (!requested) {
    return NextResponse.json(
      { ok: false, error: "invalid_access_decision" },
      {
        status: 400,
        headers: { ...NO_STORE_HEADERS, "x-request-id": auditId },
      },
    );
  }
  const { decision, productTier } = requested;

  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("access_requests")
      .select("id, email, requested_name, status")
      .eq("id", accessRequestId)
      .maybeSingle<AccessRequestRow>();
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "access_request_not_found" },
        {
          status: 404,
          headers: { ...NO_STORE_HEADERS, "x-request-id": auditId },
        },
      );
    }

    const nextStatus = decision === "approve" ? "approved" : "declined";
    if (data.status !== "pending") {
      if (data.status === nextStatus) {
        return NextResponse.json(
          { ok: true, changed: false, status: data.status },
          { headers: { ...NO_STORE_HEADERS, "x-request-id": auditId } },
        );
      }
      return NextResponse.json(
        { ok: false, error: "access_request_already_reviewed" },
        {
          status: 409,
          headers: { ...NO_STORE_HEADERS, "x-request-id": auditId },
        },
      );
    }

    let approvalDelivery: "invitation" | "password_setup" | null = null;
    if (decision === "approve") {
      if (!productTier) throw new Error("product tier is required");
      const redirectTo = accessInviteRedirectUrl(productTier);
      const { data: invitedData, error: inviteError } =
        await admin.auth.admin.inviteUserByEmail(data.email, {
          redirectTo,
          data: {
            access_invite: "approved",
            ...(data.requested_name ? { full_name: data.requested_name } : {}),
          },
        });
      if (inviteError) {
        if (
          inviteError.code === "email_exists" ||
          inviteError.code === "user_already_exists"
        ) {
          const existingUser = await findUserByEmail(admin, data.email);
          if (!existingUser) throw new Error("existing user not found");
          await assignProductTier(admin, existingUser, productTier);
          const { error: resetError } = await admin.auth.resetPasswordForEmail(
            data.email,
            { redirectTo },
          );
          if (!resetError) approvalDelivery = "password_setup";
        }
        if (!approvalDelivery) {
          console.error(
            JSON.stringify({
              event: "admin_access_invite_failed_v1",
              request_id: auditId,
              actor_user_id: auth.user_id,
              access_request_id: accessRequestId,
              at: new Date().toISOString(),
            }),
          );
          return NextResponse.json(
            { ok: false, error: "access_invitation_failed" },
            {
              status: 503,
              headers: { ...NO_STORE_HEADERS, "x-request-id": auditId },
            },
          );
        }
      } else {
        if (!invitedData.user) throw new Error("invited user unavailable");
        await assignProductTier(admin, invitedData.user, productTier);
        approvalDelivery = "invitation";
      }
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from("access_requests")
      .update({
        status: nextStatus,
        reviewed_at: now,
        reviewed_by: auth.user_id,
        updated_at: now,
        decision_note:
          decision === "approve"
            ? approvalDelivery === "password_setup"
              ? `${productTier}_password_setup_sent`
              : `${productTier}_invitation_sent`
            : "owner_declined",
      })
      .eq("id", accessRequestId)
      .eq("status", "pending")
      .select("id, status")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "access_request_already_reviewed" },
        {
          status: 409,
          headers: { ...NO_STORE_HEADERS, "x-request-id": auditId },
        },
      );
    }

    console.info(
      JSON.stringify({
        event: "admin_access_request_decision_v1",
        request_id: auditId,
        actor_user_id: auth.user_id,
        access_request_id: accessRequestId,
        decision,
        product_tier: productTier,
        at: now,
      }),
    );
    return NextResponse.json(
      { ok: true, changed: true, status: nextStatus },
      { headers: { ...NO_STORE_HEADERS, "x-request-id": auditId } },
    );
  } catch {
    console.error(
      JSON.stringify({
        event: "admin_access_request_decision_failed_v1",
        request_id: auditId,
        actor_user_id: auth.user_id,
        access_request_id: accessRequestId,
        decision,
        product_tier: productTier,
        at: new Date().toISOString(),
      }),
    );
    return NextResponse.json(
      { ok: false, error: "access_request_decision_failed" },
      {
        status: 503,
        headers: { ...NO_STORE_HEADERS, "x-request-id": auditId },
      },
    );
  }
}
