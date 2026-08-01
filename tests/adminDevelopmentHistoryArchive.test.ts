import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Admin Console contains the development-history archive section", () => {
  const page = source("components/admin/settings/AdminConsolePage.tsx");

  assert.match(page, /DevelopmentHistoryArchivePanel/);
  assert.match(page, /title="Development History Archive"/);
  assert.match(page, /<DevelopmentHistoryArchivePanel access=\{access\} \/>/);
});

test("archive status is Owner-only and keeps historical evidence non-authoritative", () => {
  const panel = source(
    "components/admin/settings/DevelopmentHistoryArchivePanel.tsx",
  );

  assert.match(panel, /access\.role !== "owner"/);
  assert.match(panel, /Owner access required/);
  assert.match(panel, /Historical wording is[\s\S]*not current philosophical authority/);
  assert.match(panel, /cannot override current Fractal Monism/);
});

test("archive panel remains inert while the backend is quarantined", () => {
  const panel = source(
    "components/admin/settings/DevelopmentHistoryArchivePanel.tsx",
  );

  assert.match(panel, /Backend quarantine active/);
  assert.match(panel, /Import export unavailable/);
  assert.match(panel, /disabled/);
  assert.doesNotMatch(panel, /authFetch/);
  assert.doesNotMatch(panel, /\bfetch\s*\(/);
  assert.doesNotMatch(panel, /\/api\//);
  assert.doesNotMatch(panel, /type=["']file["']/);
  assert.doesNotMatch(panel, /localStorage|sessionStorage/);
});

test("archive panel exposes the required approval gates without archive data", () => {
  const panel = source(
    "components/admin/settings/DevelopmentHistoryArchivePanel.tsx",
  );

  assert.match(panel, /Original source/);
  assert.match(panel, /Current source/);
  assert.match(panel, /Comparison gate/);
  assert.match(panel, /Semantic processing/);
  assert.match(panel, /Search index/);
  assert.match(panel, /Register the untouched ZIP/);
  assert.match(panel, /Review privacy candidates/);
  assert.match(panel, /Approve or reject semantic processing/);
  assert.match(panel, /No archive[\s\S]*private content are sent to this page/);
});
