import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// @ts-expect-error Node's strip-types test runner consumes TypeScript source files directly.
import {
  ACCOUNT_IDENTITY_CHANGED_EVENT,
  normalizeAccountFullName,
} from "../lib/accountIdentity.ts";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("account names are trimmed and internal whitespace is normalized", () => {
  assert.equal(normalizeAccountFullName("  Eric   Lund  "), "Eric Lund");
  assert.equal(normalizeAccountFullName(null), "");
});

test("settings pages require the shared authenticated application gate", () => {
  const layout = source("app/settings/layout.tsx");

  assert.match(layout, /import \{ AuthGate \}/);
  assert.match(layout, /<AuthGate>\{children\}<\/AuthGate>/);
});

test("account page saves an optional display name without accepting authorization metadata", () => {
  const page = source("app/settings/account/page.tsx");

  assert.match(page, /supabase\.auth\.updateUser\(\{/);
  assert.match(page, /data: \{ full_name: nextFullName \|\| null \}/);
  assert.match(page, /Display name/);
  assert.match(page, /\(optional\)/);
  assert.match(page, /Your email remains your sign-in/);
  assert.doesNotMatch(page, /data: \{ \.\.\./);
  assert.doesNotMatch(page, /Enter your full name/);
  assert.doesNotMatch(page, /!normalizeAccountFullName\(fullName\)/);
  assert.match(page, /Verified/);
  assert.match(page, /Not verified/);
  assert.match(page, /Save changes/);
  assert.doesNotMatch(page, /updateUser\(\{\s*email:/);
  assert.doesNotMatch(page, /type="email"/);
});

test("account page reads protected product access from the server and keeps load failures neutral", () => {
  const page = source("app/settings/account/page.tsx");

  assert.match(page, /authFetch\("\/api\/auth\/capabilities"/);
  assert.match(page, /productTierLabel\(access\.productTier\)/);
  assert.match(page, /roleLabel\(access\.role\)/);
  assert.match(page, /Account details could not be loaded/);
  assert.match(page, />\s*Retry\s*</);
  assert.match(page, /loadError \?/);
});

test("saved account names update the open navigation without a reload", () => {
  const page = source("app/settings/account/page.tsx");
  const menu = source("components/nav/AccountMenu.tsx");

  assert.equal(ACCOUNT_IDENTITY_CHANGED_EVENT, "vs_account_identity_changed");
  assert.match(page, /new CustomEvent\(ACCOUNT_IDENTITY_CHANGED_EVENT/);
  assert.match(menu, /window\.addEventListener\(/);
  assert.match(menu, /ACCOUNT_IDENTITY_CHANGED_EVENT/);
  assert.match(
    menu,
    /setDisplayName\(nextName \|\| nextEmail \|\| "Signed in"\)/,
  );
  assert.match(menu, /authFetch\("\/api\/auth\/capabilities"/);
  assert.match(menu, /productTierLabel\(productTier\)/);
  assert.match(menu, /roleLabel\(role\)/);
});

test("account page does not expose inert units or time-zone controls", () => {
  const page = source("app/settings/account/page.tsx");

  assert.doesNotMatch(page, /Preferred units/);
  assert.doesNotMatch(page, /Time zone/);
});
