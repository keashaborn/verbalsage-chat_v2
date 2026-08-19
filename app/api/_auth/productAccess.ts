import "server-only";

import {
  getFreshSupabaseAuthContextFromRequest,
  getSupabaseBearerAuthorizationFromRequest,
} from "@/app/api/_auth/supabaseUser";
import { productTierAllows, type ProductId } from "@/lib/productEntitlements";

export async function getFreshProductAuthContextFromRequest(
  req: Request,
  product: ProductId,
) {
  const auth = await getFreshSupabaseAuthContextFromRequest(req);
  if (!auth) return null;
  return productTierAllows(auth.app_metadata.product_tier, product)
    ? auth
    : null;
}

export async function getFreshProductUserIdFromRequest(
  req: Request,
  product: ProductId,
): Promise<string | null> {
  const auth = await getFreshProductAuthContextFromRequest(req, product);
  return auth?.user_id || null;
}

export async function getFreshLifeSwitchUserIdFromRequest(
  req: Request,
): Promise<string | null> {
  return await getFreshProductUserIdFromRequest(req, "lifeswitch");
}

export async function getFreshLifeSwitchUpstreamIdentity(req: Request): Promise<{
  user_id: string;
  authorization: string;
} | null> {
  const auth = await getFreshProductAuthContextFromRequest(req, "lifeswitch");
  const authorization = getSupabaseBearerAuthorizationFromRequest(req);
  if (!auth || !authorization) return null;
  return {
    user_id: auth.user_id,
    authorization,
  };
}
