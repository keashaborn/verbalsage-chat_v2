import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
// @ts-expect-error Node's strip-types test runner loads the TypeScript file directly.
import {
  normalizeProductTier,
  productsForTier,
  productTierAllows,
} from "../lib/productEntitlements.ts";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function routeFiles(directory: string): string[] {
  const results: string[] = [];
  function visit(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.name === "route.ts") {
        results.push(path.relative(root, absolute));
      }
    }
  }
  visit(path.join(root, directory));
  return results.sort();
}

test("product tiers are hierarchical and fail closed", () => {
  assert.equal(normalizeProductTier("verbal_sage"), "verbal_sage");
  assert.equal(normalizeProductTier("lifeswitch"), "lifeswitch");
  assert.equal(normalizeProductTier("member"), null);
  assert.equal(normalizeProductTier(undefined), null);

  assert.equal(productTierAllows("verbal_sage", "verbal_sage"), true);
  assert.equal(productTierAllows("verbal_sage", "lifeswitch"), false);
  assert.equal(productTierAllows("lifeswitch", "verbal_sage"), true);
  assert.equal(productTierAllows("lifeswitch", "lifeswitch"), true);
  assert.equal(productTierAllows(null, "verbal_sage"), false);
  assert.deepEqual(productsForTier("lifeswitch"), [
    "verbal_sage",
    "lifeswitch",
  ]);
  assert.deepEqual(productsForTier("verbal_sage"), ["verbal_sage"]);
  assert.deepEqual(productsForTier(null), []);
});

test("fresh Supabase app metadata is the product authority", () => {
  const auth = source("app/api/_auth/supabaseUser.ts");
  const productAccess = source("app/api/_auth/productAccess.ts");
  const capabilities = source("app/api/auth/capabilities/route.ts");

  assert.match(auth, /app_metadata: Record<string, unknown>/);
  assert.match(auth, /user\.app_metadata/);
  assert.match(productAccess, /getFreshSupabaseAuthContextFromRequest/);
  assert.match(productAccess, /auth\.app_metadata\.product_tier/);
  assert.match(capabilities, /getFreshSupabaseAuthContextFromRequest/);
  assert.match(capabilities, /product_access_unassigned/);
  assert.match(capabilities, /productsForTier/);
  assert.doesNotMatch(productAccess, /user_metadata/);
});

test("all private LifeSwitch APIs pass a fresh product gate", () => {
  const publicPreviewRoutes = new Set([
    "app/api/lifeswitch/people/invitations/preview/route.ts",
    "app/api/lifeswitch/training/workout_template_shares/preview/route.ts",
  ]);

  for (const relativePath of routeFiles("app/api/lifeswitch")) {
    const route = source(relativePath);
    if (publicPreviewRoutes.has(relativePath)) {
      assert.doesNotMatch(route, /getLifeSwitchOwnerUserId/);
      continue;
    }
    assert.match(
      route,
      /getLifeSwitchOwnerUserId|getFreshLifeSwitchUserIdFromRequest|productTierAllows\(auth\.app_metadata\.product_tier, "lifeswitch"\)/,
      `${relativePath} must enforce LifeSwitch product access`,
    );
  }

  const owner = source("app/api/lifeswitch/_owner.ts");
  assert.match(owner, /getFreshLifeSwitchUserIdFromRequest/);
  assert.doesNotMatch(owner, /getSupabaseUserIdFromRequest/);
});

test("legacy form and catalog proxies are no longer anonymous", () => {
  for (const directory of ["app/api/forms", "app/api/catalog"]) {
    for (const relativePath of routeFiles(directory)) {
      assert.match(
        source(relativePath),
        /getFreshLifeSwitchUserIdFromRequest/,
        `${relativePath} must enforce LifeSwitch product access`,
      );
    }
  }

  for (const relativePath of [
    "components/lifeswitch/CapturePage.tsx",
    "components/forms/FormsBuilderPage.tsx",
    "components/lifeswitch/nutrition/FoodsPage.tsx",
  ]) {
    const client = source(relativePath);
    assert.match(client, /import \{ authFetch \}/);
    assert.doesNotMatch(client, /await fetch\("\/api\/forms/);
    assert.doesNotMatch(client, /await fetch\(`\/api\/forms/);
    assert.doesNotMatch(client, /await fetch\(url, \{ cache: "no-store" \}\)/);
  }
});

test("page admission and chat execution both enforce assigned products", () => {
  const home = source("app/page.tsx");
  const lifeSwitchLayout = source("app/lifeswitch/layout.tsx");
  const collectLayout = source("app/collect/layout.tsx");
  const chat = source("app/api/chat/route.ts");

  assert.match(home, /requestSiteId/);
  assert.match(home, /<ProductAccessGate/);
  assert.match(lifeSwitchLayout, /<ProductAccessGate product="lifeswitch">/);
  assert.match(collectLayout, /<ProductAccessGate product="lifeswitch">/);
  assert.match(chat, /productTierAllows\(auth\.app_metadata\.product_tier/);
});

test("Owner product assignment is fresh, MFA-protected, and metadata-preserving", () => {
  const route = source(
    "app/api/admin/users/[userId]/product-tier/route.ts",
  );
  const directory = source("app/api/admin/users/route.ts");
  const ui = source("components/admin/settings/AdminConsolePage.tsx");

  assert.match(route, /getFreshSupabaseAuthContextFromRequest/);
  assert.match(route, /auth\.role !== "owner"/);
  assert.match(route, /hasRequiredPrivilegedAal2/);
  assert.match(route, /\.\.\.existingMetadata/);
  assert.match(route, /product_tier: productTier/);
  assert.match(route, /owner_product_tier_is_protected/);
  assert.match(route, /admin_product_tier_change_v1/);
  assert.match(directory, /product_tier/);
  assert.match(ui, /Change Product Access/);
  assert.doesNotMatch(route, /user_metadata/);
});

test("invite redirects are tier-specific and allowlisted", () => {
  const redirect = source("lib/accessInviteRedirect.ts");
  const approval = source(
    "app/api/admin/access-requests/[requestId]/route.ts",
  );
  const setup = source(
    "app/api/admin/users/[userId]/password-setup/route.ts",
  );

  assert.match(redirect, /verbalsage\.com\/auth\/accept-invite/);
  assert.match(redirect, /lifeswitch\.com\/auth\/accept-invite/);
  assert.match(redirect, /parsed\.hostname !== EXPECTED_HOSTS\[tier\]/);
  assert.match(approval, /accessInviteRedirectUrl\(productTier\)/);
  assert.match(approval, /assignProductTier/);
  assert.match(setup, /accessInviteRedirectUrl\(productTier\)/);
});
