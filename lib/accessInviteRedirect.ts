import "server-only";

import type { ProductTier } from "@/lib/productEntitlements";

const DEFAULT_REDIRECTS: Record<ProductTier, string> = {
  verbal_sage: "https://lifeswitch.com/auth/accept-invite",
  lifeswitch: "https://lifeswitch.com/auth/accept-invite",
};

const EXPECTED_HOSTS: Record<ProductTier, string> = {
  verbal_sage: "lifeswitch.com",
  lifeswitch: "lifeswitch.com",
};

export function accessInviteRedirectUrl(tier: ProductTier): string {
  const environmentName =
    tier === "lifeswitch"
      ? "LIFESWITCH_ACCESS_INVITE_REDIRECT_URL"
      : "VERBAL_SAGE_ACCESS_INVITE_REDIRECT_URL";
  const configured = String(
    process.env[environmentName] || DEFAULT_REDIRECTS[tier],
  ).trim();

  try {
    const parsed = new URL(configured);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.hostname !== EXPECTED_HOSTS[tier] ||
      parsed.pathname !== "/auth/accept-invite"
    ) {
      throw new Error("invalid redirect");
    }
    parsed.port = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return DEFAULT_REDIRECTS[tier];
  }
}
