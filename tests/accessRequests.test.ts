import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("public access requests validate input and use a server-only data path", () => {
  const route = source("app/api/access-requests/route.ts");

  assert.match(route, /getSupabaseAdminClient/);
  assert.match(route, /\.from\("access_requests"\)/);
  assert.match(route, /validEmail/);
  assert.match(route, /MAX_REQUESTS_PER_EMAIL/);
  assert.match(route, /MAX_REQUESTS_PER_NETWORK/);
  assert.match(route, /createHash\("sha256"\)/);
  assert.match(route, /status: 202/);
  assert.match(route, /GENERIC_ACCEPTED_MESSAGE/);
  assert.doesNotMatch(route, /console\.(info|error)\([^)]*email/s);
  assert.doesNotMatch(route, /NEXT_PUBLIC_SUPABASE_SECRET_KEY/);
});

test("main login offers Request access without a direct Supabase signup", () => {
  const gate = source("components/auth/AuthGate.tsx");
  const relationshipInvite = source("app/invite/lifeswitch/[token]/page.tsx");

  assert.match(gate, /Request access/);
  assert.match(gate, /fetch\("\/api\/access-requests"/);
  assert.doesNotMatch(gate, /supabase\.auth\.signUp/);
  assert.match(relationshipInvite, /supabase\.auth\.signUp/);
});

test("access request directory requires a fresh Owner identity", () => {
  const route = source("app/api/admin/access-requests/route.ts");

  assert.match(route, /getFreshSupabaseAuthContextFromRequest/);
  assert.match(route, /auth\.role !== "owner"/);
  assert.match(route, /\.from\("access_requests"\)/);
  assert.match(route, /pending_count/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /no-store/);
});

test("approval is Owner-only and records approval after invitation succeeds", () => {
  const route = source("app/api/admin/access-requests/[requestId]/route.ts");

  assert.match(route, /getFreshSupabaseAuthContextFromRequest/);
  assert.match(route, /auth\.role !== "owner"/);
  assert.match(route, /Object\.keys\(body\)\.length !== 1/);
  assert.match(route, /body\.decision !== "approve"/);
  assert.match(route, /body\.decision !== "decline"/);
  assert.match(route, /admin\.auth\.admin\.inviteUserByEmail/);
  assert.match(route, /access_invitation_failed/);
  assert.match(route, /\.eq\("status", "pending"\)/);
  assert.ok(
    route.indexOf("inviteUserByEmail") < route.indexOf("status: nextStatus"),
    "the invitation must be attempted before the request is marked approved",
  );
  assert.doesNotMatch(route, /user_metadata/);
});

test("Owner UI exposes a review queue with explicit confirmations", () => {
  const panel = source("components/admin/settings/AccessRequestsPanel.tsx");
  const consolePage = source("components/admin/settings/AdminConsolePage.tsx");

  assert.match(panel, /authFetch\("\/api\/admin\/access-requests"/);
  assert.match(panel, /Only the Owner can approve new accounts/);
  assert.match(panel, /Send Invitation/);
  assert.match(panel, /Decline Request/);
  assert.match(panel, /Recent decisions/);
  assert.doesNotMatch(panel, /window\.confirm/);
  assert.match(consolePage, /<AccessRequestsPanel access=\{access\} \/>/);
});
