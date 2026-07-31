import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const chatSource = readFileSync(
  "components/threads/BrainsChatPane.tsx",
  "utf8",
);
const listSource = readFileSync(
  "components/threads/BrainsThreadList.tsx",
  "utf8",
);

test("thread actions expose explicit conversation copy and selection", () => {
  assert.match(listSource, /Select messages/);
  assert.match(listSource, /Copy conversation/);
  assert.match(listSource, /conversation_action: conversationAction/);
  assert.match(chatSource, /conversationAction === "select_messages"/);
  assert.match(chatSource, /conversationAction === "copy_conversation"/);
  assert.match(chatSource, /if \(!copied\)/);
  assert.match(
    chatSource,
    /selectAllMessageIndexes\(loadedMessages\.length\)/,
  );
});

test("selection mode replaces the composer with a compact toolbar", () => {
  assert.match(chatSource, /aria-label="Selected message actions"/);
  assert.match(chatSource, /selectedMessageIndexes\.length} selected/);
  assert.match(chatSource, />\s*All\s*<\/button>/);
  assert.match(chatSource, />\s*Copy\s*<\/button>/);
  assert.match(chatSource, />\s*Cancel\s*<\/button>/);
  assert.match(chatSource, /grid size-5 place-items-center/);
  assert.match(chatSource, /after:-inset-3/);
  assert.match(chatSource, /sm:-left-3 sm:size-4/);
  assert.match(chatSource, /sm:after:-inset-3\.5/);
  assert.match(chatSource, /border-border\/60/);
});

test("native transcript selection excludes controls and is not message-clipped", () => {
  assert.match(chatSource, /data-chat-message/);
  assert.match(chatSource, /select-none/);
  assert.match(chatSource, /select-text/);
  assert.match(chatSource, /className="overflow-visible! select-text"/);
  assert.doesNotMatch(
    chatSource,
    /block max-w-full min-w-0 overflow-hidden text-sm leading-7/,
  );
  assert.match(chatSource, /removeAllRanges/);
});
