import { NextResponse } from "next/server";
import {
  CAPABILITY_REGISTRY,
  capabilitiesForRole,
} from "@/components/admin/settings/permissions/permissionRegistry";
import { getFreshSupabaseAuthContextFromRequest } from "@/app/api/_auth/supabaseUser";
import { normalizePermissionRole } from "@/app/api/_auth/requireCapability";
import {
  normalizeProductTier,
  productsForTier,
} from "@/lib/productEntitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await getFreshSupabaseAuthContextFromRequest(req);

  if (!auth) {
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        error: "unauthorized",
        role: "user",
        product_tier: null,
        products: [],
        capabilities: [],
        capability_count: 0,
        critical_count: 0,
        backend_enforced_count: 0,
        total_capabilities: CAPABILITY_REGISTRY.length,
      },
      { status: 401 },
    );
  }

  const role = normalizePermissionRole(auth.role);
  const productTier = normalizeProductTier(auth.app_metadata.product_tier);
  const products = productsForTier(productTier);
  if (!productTier) {
    return NextResponse.json(
      {
        ok: false,
        authenticated: true,
        error: "product_access_unassigned",
        user_id: auth.user_id,
        role,
        product_tier: null,
        products,
        capabilities: [],
        capability_count: 0,
        critical_count: 0,
        backend_enforced_count: 0,
        total_capabilities: CAPABILITY_REGISTRY.length,
      },
      { status: 403 },
    );
  }

  const capabilities = capabilitiesForRole(role).filter(
    (capability) =>
      productTier === "lifeswitch" || capability.category !== "lifeswitch",
  );

  return NextResponse.json({
    ok: true,
    authenticated: true,
    user_id: auth.user_id,
    role,
    product_tier: productTier,
    products,
    capabilities: capabilities.map((cap) => ({
      key: cap.key,
      label: cap.label,
      category: cap.category,
      scope: cap.scope,
      access: cap.access,
      risk: cap.risk,
      backendEnforced: cap.backendEnforced,
    })),
    capability_count: capabilities.length,
    critical_count: capabilities.filter((cap) => cap.risk === "critical")
      .length,
    backend_enforced_count: capabilities.filter((cap) => cap.backendEnforced)
      .length,
    total_capabilities: CAPABILITY_REGISTRY.length,
  });
}
