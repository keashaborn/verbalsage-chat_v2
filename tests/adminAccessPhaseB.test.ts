import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Supabase administrator client is server-only and uses the secret key", () => {
  const client = source("lib/supabaseAdmin.ts");

  assert.match(client, /import "server-only"/);
  assert.match(client, /process\.env\.SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(client, /NEXT_PUBLIC_SUPABASE_SECRET_KEY/);
  assert.match(client, /persistSession: false/);
  assert.match(client, /autoRefreshToken: false/);
  assert.match(client, /detectSessionInUrl: false/);
});

test("user directory requires a fresh Owner identity and returns a narrow view", () => {
  const route = source("app/api/admin/users/route.ts");

  assert.match(route, /getFreshSupabaseAuthContextFromRequest/);
  assert.match(route, /auth\.role !== "owner"/);
  assert.match(route, /admin\.auth\.admin\.listUsers/);
  assert.match(route, /perPage: 100/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /no-store/);
  assert.doesNotMatch(route, /user_metadata:/);
  assert.doesNotMatch(route, /app_metadata:/);
});

test("role changes preserve metadata and protect the Owner account", () => {
  const route = source("app/api/admin/users/[userId]/role/route.ts");

  assert.match(route, /getFreshSupabaseAuthContextFromRequest/);
  assert.match(route, /auth\.role !== "owner"/);
  assert.match(route, /Object\.keys\(body\)\.length !== 1/);
  assert.match(route, /body\.role !== "admin"/);
  assert.match(route, /body\.role !== "member"/);
  assert.match(route, /currentRole === "owner"/);
  assert.match(route, /owner_account_is_protected/);
  assert.match(route, /\.\.\.existingMetadata/);
  assert.match(route, /updateUserById/);
  assert.match(route, /admin_role_change_v1/);
  assert.match(route, /authorization_effect: "immediate_on_next_request"/);
  assert.doesNotMatch(route, /user_metadata/);
});

test("account deletion is Owner-only, email-confirmed, and narrowly scoped", () => {
  const route = source("app/api/admin/users/[userId]/route.ts");

  assert.match(route, /getFreshSupabaseAuthContextFromRequest/);
  assert.match(route, /auth\.role !== "owner"/);
  assert.match(route, /Object\.keys\(body\)\.length !== 1/);
  assert.match(route, /confirmation_email/);
  assert.match(route, /confirmation_email_mismatch/);
  assert.match(route, /targetRole === "owner"/);
  assert.match(route, /owner_account_is_protected/);
  assert.match(route, /admin\.auth\.admin\.deleteUser\(userId\)/);
  assert.match(route, /admin_user_delete_v1/);
  assert.match(route, /supabase_auth_identity/);
  assert.match(route, /retained_resources/);
  assert.doesNotMatch(route, /BRAINS_URL/);
});

test("password setup email is Owner-only and targets one Supabase user", () => {
  const route = source("app/api/admin/users/[userId]/password-setup/route.ts");

  assert.match(route, /getFreshSupabaseAuthContextFromRequest/);
  assert.match(route, /auth\.role !== "owner"/);
  assert.match(route, /admin\.auth\.admin\.getUserById\(userId\)/);
  assert.match(route, /targetRole === "owner"/);
  assert.match(route, /owner_account_is_protected/);
  assert.match(route, /admin\.auth\.resetPasswordForEmail/);
  assert.match(route, /admin_password_setup_email_v1/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_SUPABASE_SECRET_KEY/);
});

test("Admin UI uses inline confirmation and never a native confirm dialog", () => {
  const adminConsole = source("components/admin/settings/AdminConsolePage.tsx");

  assert.match(adminConsole, /authFetch\("\/api\/admin\/users"/);
  assert.match(adminConsole, /method: "PATCH"/);
  assert.match(adminConsole, /Make Admin/);
  assert.match(adminConsole, /Remove Admin/);
  assert.match(adminConsole, /Send Password Setup Email/);
  assert.match(adminConsole, /Send Setup Email/);
  assert.match(adminConsole, /\/password-setup/);
  assert.match(adminConsole, /Delete Account/);
  assert.match(adminConsole, /confirmation_email/);
  assert.match(adminConsole, /Type the account email to confirm/);
  assert.match(adminConsole, /Conversations and memory data are not deleted/);
  assert.match(
    adminConsole,
    /Only the Owner can appoint or remove administrators/,
  );
  assert.doesNotMatch(adminConsole, /window\.confirm/);
});

test("every sensitive administrative route fresh-checks the current role", () => {
  const routes = [
    "app/api/admin/cards/route.ts",
    "app/api/admin/cards/[card_id]/route.ts",
    "app/api/admin/delete_all/route.ts",
    "app/api/admin/export/route.ts",
    "app/api/admin/forget_recent/route.ts",
    "app/api/admin/memory-review/route.ts",
    "app/api/admin/vantage-cards/route.ts",
    "app/api/chat/inspect/route.ts",
  ];

  for (const routePath of routes) {
    const route = source(routePath);
    assert.match(route, /requireFreshCapability/, routePath);
    assert.doesNotMatch(route, /requireCapability\(/, routePath);
  }
});
