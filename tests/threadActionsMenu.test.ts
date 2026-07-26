import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const listSource = readFileSync(
  "components/threads/BrainsThreadList.tsx",
  "utf8",
);
const pinRouteSource = readFileSync(
  "app/api/threads/[thread_id]/pin/route.ts",
  "utf8",
);
const deleteRouteSource = readFileSync(
  "app/api/threads/[thread_id]/route.ts",
  "utf8",
);

test("touch long press and desktop context menu share the anchored actions menu", () => {
  assert.match(listSource, /window\.setTimeout\(\(\) => \{/);
  assert.match(listSource, /\}, 500\);/);
  assert.match(listSource, /onContextMenu=/);
  assert.match(listSource, /role="menu"/);
  assert.match(listSource, /Pin chat/);
  assert.match(listSource, /Rename/);
  assert.match(listSource, /Delete chat/);
});

test("thread delete no longer uses the browser-native confirmation dialog", () => {
  assert.doesNotMatch(listSource, /window\.confirm/);
  assert.match(listSource, /text-destructive/);
});

test("pin proxy validates identity, ownership, UUID, and boolean input", () => {
  assert.match(pinRouteSource, /getThreadUserId/);
  assert.match(pinRouteSource, /threadBelongsToUser/);
  assert.match(pinRouteSource, /UUID_RE/);
  assert.match(pinRouteSource, /typeof body\?\.pinned !== "boolean"/);
});

test("deleting the selected thread clears only its active-thread cookie", () => {
  assert.match(
    deleteRouteSource,
    /req\.cookies\.get\("vs_tid"\)\?\.value === tid/,
  );
  assert.match(deleteRouteSource, /response\.cookies\.delete\("vs_tid"\)/);
});
