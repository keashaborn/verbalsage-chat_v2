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

  assert.match(panel, /Personal service unavailable/);
  assert.match(panel, /Import archive unavailable/);
  assert.match(panel, /disabled/);
  assert.match(panel, /No file selection, upload, storage, or processing occurs/);
  assert.doesNotMatch(panel, /authFetch/);
  assert.doesNotMatch(panel, /\bfetch\s*\(/);
  assert.doesNotMatch(panel, /\/api\//);
  assert.doesNotMatch(panel, /type=["']file["']/);
  assert.doesNotMatch(panel, /localStorage|sessionStorage/);
});

test("personal archive preserves current authority and system separation", () => {
  const panel = source("components/settings/DataPrivacyPanel.tsx");

  assert.match(panel, /Historical material is evidence of development/);
  assert.match(panel, /cannot silently[\s\S]*override current project sources/);
  assert.match(panel, /governed[\s\S]*Memory/);
  assert.match(panel, /ordinary chat retrieval/);
  assert.match(panel, /No embeddings, vector collection/);
});

test("personal settings link to existing account controls without Admin operations", () => {
  const panel = source("components/settings/DataPrivacyPanel.tsx");

  assert.match(panel, /href="\/settings\/security"/);
  assert.match(panel, /href="\/settings\/account"/);
  assert.match(panel, /Conversation & Memory Data/);
  assert.match(panel, /Additional personal data tools can be added here/);
  assert.doesNotMatch(panel, /Users & Access/);
  assert.doesNotMatch(panel, /AI Operations/);
  assert.doesNotMatch(panel, /Memory Workbench/);
  assert.doesNotMatch(panel, /Admin Console/);
});
