import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Security page separates account security from data controls", () => {
  const page = source("app/settings/security/page.tsx");
  const panel = source("components/admin/SecurityPanel.tsx");

  assert.match(page, /<SecurityPanel view="security"/);
  assert.match(panel, /title="Password"/);
  assert.match(panel, /title="Sessions"/);
  assert.match(panel, /showSecurity/);
  assert.match(panel, /showData/);
  assert.doesNotMatch(panel, /Operator tools/);
});

test("Security page uses the authenticated Supabase account for recovery and sessions", () => {
  const panel = source("components/admin/SecurityPanel.tsx");

  assert.match(panel, /supabase\.auth\.getUser\(\)/);
  assert.match(panel, /email_confirmed_at/);
  assert.match(panel, /last_sign_in_at/);
  assert.match(panel, /resetPasswordForEmail\(email/);
  assert.match(panel, /window\.location\.origin/);
  assert.match(panel, /scope: "others"/);
  assert.match(panel, /This device remains signed in/);
});

test("Data controls retain existing protected routes with accurate labels", () => {
  const panel = source("components/admin/SecurityPanel.tsx");

  assert.match(panel, /authFetch\("\/api\/admin\/export"/);
  assert.match(panel, /\/api\/admin\/forget_recent\?minutes=/);
  assert.match(panel, /authFetch\("\/api\/admin\/delete_all"/);
  assert.match(panel, /Conversation and memory data/);
  assert.match(panel, /title="Export"/);
  assert.match(panel, /Forget recent conversations/);
  assert.match(panel, /removes those conversations\s+as memory sources/);
  assert.match(panel, /conversations you\s+keep can remain/);
  assert.match(panel, /Delete conversation and memory data/);
  assert.match(panel, /structured\s+LifeSwitch tracking data remain active/);
  assert.match(panel, /DELETE CHAT DATA/);
  assert.doesNotMatch(panel, /Delete all my data/);
  assert.doesNotMatch(panel, /Removes everything for your user/);
});

test("destructive data deletion stays collapsed until explicitly opened", () => {
  const panel = source("components/admin/SecurityPanel.tsx");

  assert.match(panel, /<details/);
  assert.match(panel, /<summary/);
  assert.match(panel, /Delete chat data/);
  assert.match(panel, /group-open:rotate-90/);
  assert.match(
    panel,
    /if \(!event\.currentTarget\.open\) setDeleteConfirm\(""\)/,
  );
  assert.doesNotMatch(panel, /<details[^>]*\sopen(?:=|\s|>)/);
});

test("Recovery setup page distinguishes password changes from new access", () => {
  const page = source("app/auth/accept-invite/page.tsx");

  assert.match(page, /useSiteBrand\(\)/);
  assert.match(page, /Change your \$\{brand\.name\} password/);
  assert.match(page, /Your \$\{brand\.name\} access was approved/);
  assert.match(page, /siteId === "lifeswitch"/);
  assert.match(page, /Create a new password/);
  assert.match(page, /Save new password/);
  assert.match(page, /Your password has been changed/);
});

test("Owner security settings support primary and backup TOTP enrollment", () => {
  const panel = source("components/admin/SecurityPanel.tsx");

  assert.match(panel, /role === "owner" \|\| role === "admin"/);
  assert.match(panel, /supabase\.auth\.mfa\.listFactors\(\)/);
  assert.match(
    panel,
    /supabase\.auth\.mfa\.getAuthenticatorAssuranceLevel\(\)/,
  );
  assert.match(panel, /supabase\.auth\.mfa\.enroll\(\{/);
  assert.match(panel, /factorType: "totp"/);
  assert.match(panel, /friendlyName/);
  assert.match(panel, /issuer: "LifeSwitch"/);
  assert.match(panel, /supabase\.auth\.mfa\.challengeAndVerify\(\{/);
  assert.match(panel, /Set up primary authenticator/);
  assert.match(panel, /Add independent backup authenticator/);
  assert.match(panel, /mfaFactors\.length >= 2/);
  assert.match(panel, /Supabase does\s+not issue recovery codes/);
  assert.doesNotMatch(panel, /console\.(?:log|info|warn|error).*totp/i);
});

test("Auth gate blocks protected accounts until the enrolled factor is verified", () => {
  const gate = source("components/auth/AuthGate.tsx");

  assert.match(gate, /role === "owner" \|\| role === "admin"/);
  assert.match(gate, /supabase\.auth\.mfa\.getAuthenticatorAssuranceLevel\(\)/);
  assert.match(gate, /currentLevel === "aal1"/);
  assert.match(gate, /nextLevel === "aal2"/);
  assert.match(gate, /supabase\.auth\.mfa\.listFactors\(\)/);
  assert.match(gate, /supabase\.auth\.mfa\.challengeAndVerify\(\{/);
  assert.match(gate, /mfaGate === "clear"/);
  assert.match(gate, /The application remains locked/);
  assert.match(gate, /Verify and continue/);
});
