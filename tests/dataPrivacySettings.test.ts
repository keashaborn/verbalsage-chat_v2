import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Account menu exposes Data & Privacy to every authenticated user", () => {
  const menu = source("components/nav/AccountMenu.tsx");
  const privacyLink = menu.indexOf('href="/settings/data-privacy"');
  const adminCondition = menu.indexOf("{hasAdminAccess ? (");

  assert.ok(privacyLink > 0);
  assert.ok(adminCondition > privacyLink);
  assert.match(menu, />\s*Data &amp; Privacy\s*</);
});

test("Data & Privacy is protected by the shared settings authentication gate", () => {
  const layout = source("app/settings/layout.tsx");
  const page = source("app/settings/data-privacy/page.tsx");

  assert.match(layout, /<AuthGate>\{children\}<\/AuthGate>/);
  assert.match(page, /title="Data & Privacy"/);
  assert.match(page, /<DataPrivacyPanel \/>/);
});

test("personal archive controls are inert during backend quarantine", () => {
  const panel = source("components/settings/DataPrivacyPanel.tsx");

  assert.match(panel, /Personal archive/);
  assert.match(panel, /Import unavailable/);
  assert.match(panel, /disabled/);
  assert.doesNotMatch(panel, /authFetch/);
  assert.doesNotMatch(panel, /\bfetch\s*\(/);
  assert.doesNotMatch(panel, /\/api\//);
  assert.doesNotMatch(panel, /type=["']file["']/);
  assert.doesNotMatch(panel, /localStorage|sessionStorage/);
});

test("personal archive preserves current authority and system separation", () => {
  const panel = source("components/settings/DataPrivacyPanel.tsx");

  assert.match(panel, /Historical material remains evidence of development/);
  assert.match(panel, /cannot[\s\S]*override current sources/);
  assert.match(panel, /governed[\s\S]*Memory/);
  assert.match(panel, /Search index/);
  assert.match(panel, /Not created/);
});

test("personal settings contain the protected data controls and link to Account", () => {
  const panel = source("components/settings/DataPrivacyPanel.tsx");

  assert.match(panel, /<SecurityPanel view="data"/);
  assert.match(panel, /href="\/settings\/account"/);
  assert.match(panel, /Conversation & Memory Data/);
  assert.match(panel, /setOpenSection/);
  assert.doesNotMatch(panel, /Users & Access/);
  assert.doesNotMatch(panel, /AI Operations/);
  assert.doesNotMatch(panel, /Memory Workbench/);
  assert.doesNotMatch(panel, /Admin Console/);
});
