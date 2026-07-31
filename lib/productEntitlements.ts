export const PRODUCT_TIERS = ["verbal_sage", "lifeswitch"] as const;

export type ProductTier = (typeof PRODUCT_TIERS)[number];
export type ProductId = ProductTier;

export function normalizeProductTier(value: unknown): ProductTier | null {
  return value === "verbal_sage" || value === "lifeswitch" ? value : null;
}

export function productTierAllows(tier: unknown, product: ProductId): boolean {
  const normalized = normalizeProductTier(tier);
  if (!normalized) return false;
  if (normalized === "lifeswitch") return true;
  return product === "verbal_sage";
}

export function productsForTier(tier: unknown): ProductId[] {
  const normalized = normalizeProductTier(tier);
  if (normalized === "lifeswitch") return ["verbal_sage", "lifeswitch"];
  if (normalized === "verbal_sage") return ["verbal_sage"];
  return [];
}

export function productTierLabel(tier: unknown): string {
  const normalized = normalizeProductTier(tier);
  if (normalized === "lifeswitch") return "LifeSwitch";
  if (normalized === "verbal_sage") return "Verbal Sage";
  return "Unassigned";
}
