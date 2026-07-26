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
  assert.match(route, /sendAccessRequestNotification/);
  assert.match(route, /persisted\.shouldNotify/);
  assert.doesNotMatch(route, /console\.(info|error)\([^)]*email/s);
  assert.doesNotMatch(route, /NEXT_PUBLIC_SUPABASE_SECRET_KEY/);
});

test("owner notifications use a bounded server-only Resend request", () => {
  const notification = source("lib/accessRequestNotification.ts");

  assert.match(notification, /import "server-only"/);
  assert.match(notification, /process\.env\.RESEND_API_KEY/);
  assert.match(notification, /process\.env\.ACCESS_REQUEST_NOTIFY_EMAIL/);
  assert.match(notification, /https:\/\/api\.resend\.com\/emails/);
  assert.match(notification, /Authorization: `Bearer \$\{config\.apiKey\}`/);
  assert.match(notification, /Idempotency-Key/);
  assert.match(notification, /LifeSwitch <no-reply@mail\.lifeswitch\.com>/);
  assert.match(notification, /subject: "New LifeSwitch access request"/);
  assert.match(notification, /text: notificationText\(input\)/);
  assert.match(notification, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/);
  assert.doesNotMatch(notification, /NEXT_PUBLIC_/);
  assert.doesNotMatch(notification, /console\./);
});

test("notification failures do not change the generic public response", () => {
  const route = source("app/api/access-requests/route.ts");

  const sendIndex = route.indexOf("await sendAccessRequestNotification");
  const acceptedIndex = route.indexOf("return acceptedResponse()", sendIndex);
  assert.ok(sendIndex >= 0);
  assert.ok(acceptedIndex > sendIndex);
  assert.doesNotMatch(route.slice(sendIndex, acceptedIndex), /throw new Error/);
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
  assert.match(route, /https:\/\/verbalsage\.com\/auth\/accept-invite/);
  assert.match(route, /access_invite: "approved"/);
  assert.match(route, /access_invitation_failed/);
  assert.match(route, /\.eq\("status", "pending"\)/);
  assert.ok(
    route.indexOf("inviteUserByEmail") < route.indexOf("status: nextStatus"),
    "the invitation must be attempted before the request is marked approved",
  );
  assert.doesNotMatch(route, /user_metadata/);
});

test("approved access invitations have a dedicated password setup page", () => {
  const page = source("app/auth/accept-invite/page.tsx");

  assert.match(page, /Your LifeSwitch access was approved/);
  assert.match(page, /Create your password/);
  assert.match(page, /Confirm password/);
  assert.match(page, /\.getSession\(\)/);
  assert.match(page, /\.onAuthStateChange\(/);
  assert.match(page, /supabase\.auth\.updateUser\(\{ password \}\)/);
  assert.match(page, /access_invite === "approved"/);
  assert.doesNotMatch(page, /supabase\.auth\.signUp/);
  assert.doesNotMatch(page, /invite\/lifeswitch/);
});

test("invite email uses a scanner-safe two-step confirmation page", () => {
  const template = source("docs/supabase-invite-email-template.html");
  const page = source("app/auth/confirm-invite/page.tsx");

  assert.match(
    template,
    /\/auth\/confirm-invite\?confirmation_url=\{\{ \.ConfirmationURL \}\}/,
  );
  assert.doesNotMatch(
    template,
    /href="\{\{ \.ConfirmationURL \}\}"/,
  );
  assert.match(page, /Accept your LifeSwitch invitation/);
  assert.match(page, /Accept invitation/);
  assert.match(page, /validateAccessInviteConfirmationUrl/);
  assert.match(page, /window\.location\.assign\(confirmationUrl\)/);
  assert.doesNotMatch(page, /supabase\.auth\.(verifyOtp|setSession)/);
});

test("invite confirmation URL validation is fail-closed", async () => {
  const moduleUrl = new URL(
    "../lib/accessInviteConfirmation.ts",
    import.meta.url,
  ).href;
  const { validateAccessInviteConfirmationUrl } = await import(moduleUrl);
  const supabaseUrl = "https://project-ref.supabase.co";
  const appOrigin = "https://verbalsage.com";
  const redirect = encodeURIComponent(
    "https://verbalsage.com/auth/accept-invite",
  );
  const valid =
    `https://project-ref.supabase.co/auth/v1/verify` +
    `?token=token-hash&type=invite&redirect_to=${redirect}`;

  assert.equal(
    validateAccessInviteConfirmationUrl(valid, supabaseUrl, appOrigin),
    valid,
  );
  assert.equal(
    validateAccessInviteConfirmationUrl(
      valid.replace("type=invite", "type=recovery"),
      supabaseUrl,
      appOrigin,
    ),
    null,
  );
  assert.equal(
    validateAccessInviteConfirmationUrl(
      valid.replace("project-ref.supabase.co", "attacker.example"),
      supabaseUrl,
      appOrigin,
    ),
    null,
  );
  assert.equal(
    validateAccessInviteConfirmationUrl(
      valid.replace(
        encodeURIComponent("https://verbalsage.com/auth/accept-invite"),
        encodeURIComponent("https://attacker.example/steal"),
      ),
      supabaseUrl,
      appOrigin,
    ),
    null,
  );
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
