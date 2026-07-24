import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const autoTitle = fs.readFileSync(
  path.join(root, "app/api/threads/[thread_id]/auto-title/route.ts"),
  "utf8",
);
const manualRename = fs.readFileSync(
  path.join(root, "app/api/threads/[thread_id]/rename/route.ts"),
  "utf8",
);
const chatPane = fs.readFileSync(
  path.join(root, "components/threads/BrainsChatPane.tsx"),
  "utf8",
);

test("automatic title generation is delegated to the backend", () => {
  assert.match(autoTitle, /\/auto-title`/);
  assert.doesNotMatch(autoTitle, /fallbackTitle|generateTitle|cleanTitle/);
});

test("manual rename calls are explicitly marked manual", () => {
  assert.match(manualRename, /title_source:\s*"manual"/);
});

test("automatic title route returns backend preservation outcome", () => {
  assert.match(autoTitle, /updated:\s*result\?\.updated !== false/);
  assert.match(autoTitle, /skipped:\s*result\?\.skipped \|\| null/);
});

test("browser does not submit conversation text for title generation", () => {
  assert.match(chatPane, /auto-title[\s\S]*body:\s*"\{\}"/);
  assert.doesNotMatch(chatPane, /auto-title[\s\S]{0,500}JSON\.stringify\(\{\s*input:/);
});

test("both title routes retain authenticated ownership checks", () => {
  for (const source of [autoTitle, manualRename]) {
    assert.match(source, /getThreadUserId\(req\)/);
    assert.match(source, /threadBelongsToUser\(tid, user_id, requestId\)/);
  }
});
