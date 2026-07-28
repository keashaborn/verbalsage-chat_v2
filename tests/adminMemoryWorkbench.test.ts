import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("memory workbench proxy derives the owner from fresh Supabase auth", () => {
  const route = source("app/api/admin/memory-workbench/route.ts");

  assert.match(route, /requireFreshCapability\(req, "memory_system\.view"\)/);
  assert.match(route, /requireFreshCapability\(req, "memory_system\.manage"\)/);
  assert.match(route, /payload\?\.sub/);
  assert.match(route, /brainsUpstreamHeaders\(correlationId, actorUserId/);
  assert.match(route, /x-vs-authorized-capability/);
  assert.match(route, /\/admin\/memory\/workbench/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /no-store/);
  assert.doesNotMatch(route, /owner_user_id/);
});

test("memory workbench shows source, interpretation, and binary feedback", () => {
  const panel = source(
    "components/admin/settings/MemoryWorkbenchPanel.tsx",
  );
  const health = source(
    "components/admin/settings/MemorySystemHealthPanel.tsx",
  );

  assert.match(health, /<MemoryWorkbenchPanel \/>/);
  assert.match(panel, /What was sent to the private GPU/);
  assert.match(panel, /What the GPU inferred/);
  assert.match(panel, /Correct\s*<\/button>/);
  assert.match(panel, /Not correct\s*<\/button>/);
  assert.match(panel, /note is for system diagnosis and is not treated as memory/);
  assert.doesNotMatch(panel, /Delete/);
  assert.doesNotMatch(panel, /Edit memory/);
});
