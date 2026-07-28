import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Admin Console presents the retained product sections", () => {
  const adminConsole = source("components/admin/settings/AdminConsolePage.tsx");

  assert.match(adminConsole, /Voice Health/);
  assert.match(adminConsole, /Response Diagnostics/);
  assert.match(adminConsole, /Usage & Analytics/);
  assert.match(adminConsole, /Users & Access/);
  assert.match(adminConsole, /Memory Health/);
  assert.match(adminConsole, /Make Admin/);
  assert.match(adminConsole, /Remove Admin/);
  assert.doesNotMatch(adminConsole, /Not configured/);
});

test("legacy permission catalog is not rendered in the Admin Console", () => {
  const adminConsole = source("components/admin/settings/AdminConsolePage.tsx");

  assert.doesNotMatch(adminConsole, /CAPABILITY_REGISTRY/);
  assert.doesNotMatch(adminConsole, /PERMISSION_ROLES/);
  assert.doesNotMatch(adminConsole, /capabilitiesForRole/);
  assert.doesNotMatch(adminConsole, /client fallback/);
  assert.doesNotMatch(adminConsole, /Permissions \/ Identity Preview/);
  assert.doesNotMatch(adminConsole, /Vantage registry/);
});

test("Admin page and navigation use fresh server-verified access", () => {
  const page = source("app/admin/page.tsx");
  const menu = source("components/nav/AccountMenu.tsx");
  const accessRoute = source("app/api/admin/access/route.ts");

  assert.match(page, /authFetch\("\/api\/admin\/access"/);
  assert.doesNotMatch(page, /app_metadata/);
  assert.match(menu, /authFetch\("\/api\/admin\/access"/);
  assert.doesNotMatch(menu, /app_metadata\?\.role/);
  assert.match(accessRoute, /getFreshSupabaseAuthContextFromRequest/);
  assert.match(accessRoute, /auth\.role !== "owner" && auth\.role !== "admin"/);
  assert.match(accessRoute, /Cache-Control/);
  assert.match(accessRoute, /no-store/);
});

test("System Tools require fresh Owner or Admin authorization", () => {
  const debugRoute = source("app/api/admin/debug_cookie/route.ts");
  const voiceHealthRoute = source("app/api/admin/voice-health/route.ts");
  const registry = source(
    "components/admin/settings/permissions/permissionRegistry.ts",
  );

  assert.doesNotMatch(debugRoute, /requireCapability\(/);
  assert.match(debugRoute, /requireFreshCapability/);
  assert.doesNotMatch(voiceHealthRoute, /requireCapability\(/);
  assert.match(voiceHealthRoute, /requireFreshCapability/);
  assert.match(
    registry,
    /key: "inspector\.view"[\s\S]*?defaultRoles: \["owner", "admin"\]/,
  );
  assert.match(
    registry,
    /key: "diagnostics\.view"[\s\S]*?defaultRoles: \["owner", "admin"\]/,
  );
  assert.match(
    registry,
    /key: "admin_console\.view"[\s\S]*?defaultRoles: \["owner", "admin"\]/,
  );
});
