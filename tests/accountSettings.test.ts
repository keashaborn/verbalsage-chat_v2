import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// @ts-expect-error Node's strip-types test runner consumes TypeScript source files directly.
import { ACCOUNT_IDENTITY_CHANGED_EVENT, normalizeAccountFullName } from "../lib/accountIdentity.ts";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("account names are trimmed and internal whitespace is normalized", () => {
  assert.equal(normalizeAccountFullName("  Eric   Lund  "), "Eric Lund");
  assert.equal(normalizeAccountFullName(null), "");
});

test("account page saves display identity while presenting email as non-editable text", () => {
  const page = source("app/settings/account/page.tsx");

  assert.match(page, /supabase\.auth\.updateUser\(\{/);
  assert.match(page, /data: nextMetadata/);
  assert.match(page, /\{ \.\.\.metadata, full_name: nextFullName \}/);
  assert.match(page, /\{email \|\| "Unavailable"\}/);
  assert.match(page, /Verified/);
  assert.match(page, /Not verified/);
  assert.match(page, /Save changes/);
  assert.doesNotMatch(page, /updateUser\(\{\s*email:/);
  assert.doesNotMatch(page, /type="email"/);
});

test("saved account names update the open navigation without a reload", () => {
  const page = source("app/settings/account/page.tsx");
  const menu = source("components/nav/AccountMenu.tsx");

  assert.equal(
    ACCOUNT_IDENTITY_CHANGED_EVENT,
    "vs_account_identity_changed",
  );
  assert.match(page, /new CustomEvent\(ACCOUNT_IDENTITY_CHANGED_EVENT/);
  assert.match(menu, /window\.addEventListener\(/);
  assert.match(menu, /ACCOUNT_IDENTITY_CHANGED_EVENT/);
  assert.match(menu, /setDisplayName\(nextName\)/);
});

test("account page does not expose inert units or time-zone controls", () => {
  const page = source("app/settings/account/page.tsx");

  assert.doesNotMatch(page, /Preferred units/);
  assert.doesNotMatch(page, /Time zone/);
});
