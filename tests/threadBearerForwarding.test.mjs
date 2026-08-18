import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const threadRoutes = [
  "app/api/threads/route.ts",
  "app/api/threads/active/route.ts",
  "app/api/threads/clear/route.ts",
  "app/api/threads/select/route.ts",
  "app/api/threads/[thread_id]/messages/route.ts",
  "app/api/threads/[thread_id]/rename/route.ts",
  "app/api/threads/[thread_id]/pin/route.ts",
  "app/api/threads/[thread_id]/auto-title/route.ts",
];

test("every active thread proxy forwards the verified bearer", () => {
  for (const relative of threadRoutes) {
    const source = read(relative);
    assert.match(source, /threadUpstreamHeaders\(req, requestId, user_id,/);
    assert.doesNotMatch(source, /brainsUpstreamHeaders\(/);
  }
});

test("thread ownership preflight forwards the same verified bearer", () => {
  const source = read("app/api/threads/_threadAuth.ts");
  assert.match(source, /getSupabaseBearerAuthorizationFromRequest\(req\)/);
  assert.match(source, /headers\.set\("authorization", authorization\)/);
  assert.match(source, /threadUpstreamHeaders\(req, requestId, user_id,/);
});

test("inspector active-thread lookup forwards its verified bearer", () => {
  const source = read("app/api/chat/inspect/route.ts");
  assert.match(source, /getSupabaseBearerAuthorizationFromRequest\(req\)/);
  assert.match(source, /Accept: "application\/json",\s+authorization,/);
});
