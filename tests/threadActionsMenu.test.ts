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
  assert.match(listSource, /Select messages/);
  assert.match(listSource, /Copy conversation/);
  assert.match(listSource, /Rename/);
  assert.match(listSource, /Delete chat/);
});

test("thread delete no longer uses the browser-native confirmation dialog", () => {
  assert.doesNotMatch(listSource, /window\.confirm/);
  assert.match(listSource, /text-destructive/);
});

test("thread rename avoids nested mobile dialogs and keeps desktop portaled", () => {
  const mobileEditor = listSource.match(
    /if \(isMobile && isEditing\)[\s\S]*?<\/form>/,
  )?.[0];

  assert.ok(mobileEditor);
  assert.match(listSource, /from "@\/components\/ui\/dialog"/);
  assert.match(listSource, /<DialogContent/);
  assert.match(listSource, /if \(isMobile && isEditing\)/);
  assert.match(listSource, /\{!isMobile && \(/);
  assert.match(listSource, /id=\{`rename-chat-\$\{tid\}`\}/);
  assert.match(mobileEditor, /elements\.namedItem\("chat-name"\)/);
  assert.match(mobileEditor, /input instanceof HTMLInputElement/);
  assert.match(mobileEditor, /input\.blur\(\)/);
  assert.match(mobileEditor, /text-\[16px\]/);
  assert.doesNotMatch(mobileEditor, /autoFocus/);
  assert.match(listSource, /text-base outline-none sm:text-sm/);
  assert.doesNotMatch(listSource, /z-\[10000\]/);
});

test("pin proxy validates identity, ownership, UUID, and boolean input", () => {
  assert.match(pinRouteSource, /getThreadUserId/);
  assert.match(pinRouteSource, /threadBelongsToUser/);
  assert.match(pinRouteSource, /UUID_RE/);
  assert.match(pinRouteSource, /typeof body\?\.pinned !== "boolean"/);
});

test("thread deletion leaves active-state repair to the Brains owner contract", () => {
  assert.doesNotMatch(deleteRouteSource, /vs_tid|response\.cookies/);
  assert.match(deleteRouteSource, /method: "DELETE"/);
});
