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

  assert.match(
    page,
    /Manage password access, active sessions, and private data controls/,
  );
  assert.match(panel, /Account security/);
  assert.match(panel, /Data &amp; privacy/);
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
  assert.match(panel, /Download my data/);
  assert.match(panel, /Forget recent conversations/);
  assert.match(panel, /Delete conversation and memory data/);
  assert.match(panel, /structured\s+LifeSwitch tracking data remain active/);
  assert.match(panel, /DELETE CHAT DATA/);
  assert.doesNotMatch(panel, /Delete all my data/);
  assert.doesNotMatch(panel, /Removes everything for your user/);
});

test("Recovery setup page distinguishes password changes from new access", () => {
  const page = source("app/auth/accept-invite/page.tsx");

  assert.match(page, /Change your LifeSwitch password/);
  assert.match(page, /Your LifeSwitch access was approved/);
  assert.match(page, /Create a new password/);
  assert.match(page, /Save new password/);
  assert.match(page, /Your password has been changed/);
});
