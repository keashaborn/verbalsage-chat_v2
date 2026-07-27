import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("memory health proxy uses fresh capability and authenticated actor identity", () => {
  const route = source("app/api/admin/memory-health/route.ts");

  assert.match(route, /requireFreshCapability\(req, "memory_system\.view"\)/);
  assert.match(route, /payload\?\.sub/);
  assert.match(route, /brainsUpstreamHeaders\(correlationId, actorUserId/);
  assert.match(route, /\/admin\/memory\/health/);
  assert.match(route, /scope !== "current_actor"/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /no-store/);
  assert.doesNotMatch(route, /memory_cards\.view_raw/);
});

test("Admin memory section mounts only when opened and retires legacy card UI", () => {
  const page = source("components/admin/settings/AdminConsolePage.tsx");

  assert.match(page, /title="Memory Health"/);
  assert.match(page, /<MemorySystemHealthPanel \/>/);
  assert.match(page, /mountWhenOpen/);
  assert.doesNotMatch(page, /<MemoryReviewPanel \/>/);
  assert.doesNotMatch(page, /<CardsPanel \/>/);
  assert.doesNotMatch(page, /Memory \/ Retrieval Evaluation/);
});

test("memory health UI exposes aggregates without raw memory controls", () => {
  const panel = source("components/admin/settings/MemorySystemHealthPanel.tsx");

  assert.match(panel, /Operational status for the signed-in account/);
  assert.match(panel, /Governed claims/);
  assert.match(panel, /Claim index/);
  assert.match(panel, /Processing queue/);
  assert.match(panel, /Answer use/);
  assert.doesNotMatch(panel, /Raw JSON/);
  assert.doesNotMatch(panel, /Delete/);
});
