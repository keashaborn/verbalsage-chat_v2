import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("usage BFF derives fresh authority and forwards an explicit capability", () => {
  const shared = source("app/api/admin/usage/_shared.ts");

  assert.match(
    shared,
    /requireFreshCapability\(req, "usage_analytics\.view"\)/,
  );
  assert.match(shared, /auth\.auth\?\.user_id/);
  assert.match(
    shared,
    /"x-vs-authorized-capability": "usage_analytics\.view"/,
  );
  assert.match(shared, /brainsUpstreamHeaders\(correlationId, actorUserId/);
  assert.match(shared, /Cache-Control/);
  assert.match(shared, /no-store/);
  assert.doesNotMatch(shared, /SUPABASE_SECRET_KEY/);
});

test("usage BFF exposes overview, bounded cursor users, and one-user detail", () => {
  const overview = source("app/api/admin/usage/overview/route.ts");
  const users = source("app/api/admin/usage/users/route.ts");
  const detail = source("app/api/admin/usage/users/[userId]/route.ts");
  const shared = source("app/api/admin/usage/_shared.ts");

  assert.match(overview, /\/admin\/usage\/overview\?window=/);
  assert.match(overview, /admin_usage_overview_v1/);
  assert.match(users, /MAX_LIMIT/);
  assert.match(users, /next_cursor/);
  assert.match(users, /visibleIdentities/);
  assert.match(detail, /visibleIdentity/);
  assert.match(detail, /admin_usage_user_detail_v1/);
  assert.match(shared, /MAX_LIMIT = 50/);
  assert.match(shared, /admin\.auth\.admin\.getUserById/);
  assert.doesNotMatch(shared, /admin\.auth\.admin\.listUsers/);
  assert.match(
    shared,
    /\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}/,
  );
  assert.doesNotMatch(shared, /\[1-5\]\[0-9a-f\]\{3\}/);
  assert.equal(
    fs.existsSync(path.join(root, "app/api/admin/usage/route.ts")),
    false,
  );
});

test("usage UI is a distinct overview-first paginated area", () => {
  const page = source("components/admin/settings/AdminConsolePage.tsx");
  const panel = source(
    "components/admin/settings/UsageAnalyticsPanel.tsx",
  );

  assert.match(page, /title="Usage & Analytics"/);
  assert.match(page, /<UsageAnalyticsPanel \/>/);
  assert.match(page, /mountWhenOpen/);
  assert.match(panel, /Active users/);
  assert.match(panel, /User explorer/);
  assert.match(panel, /next_cursor/);
  assert.match(panel, /Previous/);
  assert.match(panel, /User detail/);
  assert.match(panel, /AI by model/);
  assert.match(panel, /Earlier usage\s+is not estimated or backfilled/);
  assert.match(panel, /Pricing is omitted/);
  assert.doesNotMatch(
    panel,
    /message content|food name|exercise name|health measurement|raw exception/i,
  );
});

test("usage capability remains restricted to owner and admin", () => {
  const registry = source(
    "components/admin/settings/permissions/permissionRegistry.ts",
  );
  const start = registry.indexOf('key: "usage_analytics.view"');
  assert.notEqual(start, -1);
  const block = registry.slice(start, start + 500);

  assert.match(block, /defaultRoles: \["owner", "admin"\]/);
  assert.match(block, /backendEnforced: true/);
});
