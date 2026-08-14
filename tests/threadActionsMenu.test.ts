import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
// @ts-expect-error Node's strip-types test runner loads the TypeScript file directly.
import {
  CONVERSATION_ERASURE_DATA_DOMAIN,
  CONVERSATION_ERASURE_REQUEST_VERSION,
  conversationThreadDeletionConfirmationSha256,
} from "../lib/conversationErasure.ts";

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
  assert.match(listSource, /setDeleteCandidate\(actionMenu\.thread\)/);
  assert.match(listSource, /<DialogTitle className="text-sm">Delete chat\?/);
  assert.match(listSource, /<DialogDescription>/);
  assert.match(listSource, /autoFocus/);
  assert.doesNotMatch(
    listSource,
    /onClick=\{\(\) => deleteThread\(actionMenu\.thread\.thread_id\)\}/,
  );
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

test("thread erasure confirmation matches the governed-memory Python contract", () => {
  assert.equal(
    conversationThreadDeletionConfirmationSha256(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ),
    "d782830b3395b38033ff2d9c924e56f87687aec6fccf19383d7d8ef6f506c6c5",
  );
  assert.equal(
    CONVERSATION_ERASURE_REQUEST_VERSION,
    "governed-memory-conversation-deletion-request-v1",
  );
  assert.equal(
    CONVERSATION_ERASURE_DATA_DOMAIN,
    "chat_source_and_derived_governed_conversational_memory_v1",
  );
});

test("thread deletion uses the governed chat-only erasure coordinator", () => {
  assert.doesNotMatch(deleteRouteSource, /vs_tid|response\.cookies/);
  assert.doesNotMatch(deleteRouteSource, /`\$\{BRAINS\}\/threads\//);
  assert.match(
    deleteRouteSource,
    /ERASURE_REQUEST_PATH = "\/memory\/conversations\/erasure-requests"/,
  );
  assert.match(deleteRouteSource, /method: "POST"/);
  assert.match(deleteRouteSource, /Authorization: authorization/);
  assert.match(deleteRouteSource, /contract_version:/);
  assert.match(deleteRouteSource, /data_domain:/);
  assert.match(deleteRouteSource, /confirmation_sha256:/);
  assert.match(deleteRouteSource, /selector_kind: "thread"/);
  assert.match(deleteRouteSource, /thread_id: threadId/);
  assert.match(deleteRouteSource, /method: "GET"/);
  assert.match(deleteRouteSource, /status\.state === "completed"/);
  assert.match(deleteRouteSource, /operationId = threadId/);
});
