import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getFreshSupabaseAuthContextFromRequest } from "@/app/api/_auth/supabaseUser";
import {
  hasRequiredPrivilegedAal2,
  PRIVILEGED_MFA_REQUIRED_ERROR,
  PRIVILEGED_MFA_REQUIRED_STATUS,
} from "@/app/api/_auth/privilegedMfa";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
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

function requestId(req: Request): string {
  const raw = String(
    req.headers.get("x-request-id") ||
      req.headers.get("x-correlation-id") ||
      "",
  ).trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

async function requestedProductTier(req: Request): Promise<ProductTier | null> {
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
      Object.keys(body).length !== 1
    ) {
      return null;
    }
    return normalizeProductTier(body.product_tier);
  } catch {
    return null;
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const id = requestId(req);
  const headers = { ...NO_STORE_HEADERS, "x-request-id": id };
  const auth = await getFreshSupabaseAuthContextFromRequest(req);
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers },
    );
  }
  if (auth.role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "owner_access_required" },
      { status: 403, headers },
    );
  }
  if (!hasRequiredPrivilegedAal2(auth)) {
    return NextResponse.json(
      { ok: false, error: PRIVILEGED_MFA_REQUIRED_ERROR },
      { status: PRIVILEGED_MFA_REQUIRED_STATUS, headers },
    );
  }

  const { userId } = await context.params;
  if (!UUID_PATTERN.test(userId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_user_id" },
      { status: 400, headers },
    );
  }
  const productTier = await requestedProductTier(req);
  if (!productTier) {
    return NextResponse.json(
      { ok: false, error: "invalid_product_tier_request" },
      { status: 400, headers },
    );
  }

  try {
    const admin = getSupabaseAdminClient();
    const { data: currentData, error: currentError } =
      await admin.auth.admin.getUserById(userId);
    if (currentError || !currentData.user) {
      return NextResponse.json(
        { ok: false, error: "user_not_found" },
        { status: 404, headers },
      );
    }

    const existingMetadata =
      currentData.user.app_metadata &&
      typeof currentData.user.app_metadata === "object" &&
      !Array.isArray(currentData.user.app_metadata)
        ? currentData.user.app_metadata
        : {};
    const currentTier = normalizeProductTier(existingMetadata.product_tier);
    const currentRole = String(existingMetadata.role || "").trim();
    if (currentRole === "owner" && productTier !== "lifeswitch") {
      return NextResponse.json(
        { ok: false, error: "owner_product_tier_is_protected" },
        { status: 409, headers },
      );
    }
    if (currentTier === productTier) {
      return NextResponse.json(
        { ok: true, changed: false, user_id: userId, product_tier: productTier },
        { headers },
      );
    }

    const { data: updatedData, error: updateError } =
      await admin.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...existingMetadata,
          product_tier: productTier,
        },
      });
    if (updateError || !updatedData.user) throw updateError || new Error();
    if (
      normalizeProductTier(updatedData.user.app_metadata?.product_tier) !==
      productTier
    ) {
      throw new Error("product tier verification failed");
    }

    console.info(
      JSON.stringify({
        event: "admin_product_tier_change_v1",
        request_id: id,
        actor_user_id: auth.user_id,
        target_user_id: userId,
        previous_product_tier: currentTier || "unassigned",
        new_product_tier: productTier,
        authorization_effect: "immediate_on_next_fresh_request",
        at: new Date().toISOString(),
      }),
    );

    return NextResponse.json(
      { ok: true, changed: true, user_id: userId, product_tier: productTier },
      { headers },
    );
  } catch {
    console.error(
      JSON.stringify({
        event: "admin_product_tier_change_failed_v1",
        request_id: id,
        actor_user_id: auth.user_id,
        target_user_id: userId,
        requested_product_tier: productTier,
        at: new Date().toISOString(),
      }),
    );
    return NextResponse.json(
      { ok: false, error: "product_tier_change_failed" },
      { status: 503, headers },
    );
  }
}
