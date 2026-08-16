import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
// @ts-expect-error Node's strip-types test runner loads the TypeScript file directly.
import {
  CONVERSATION_ERASURE_DATA_DOMAIN,
  CONVERSATION_ERASURE_REQUEST_VERSION,
  conversationAllDeletionConfirmationSha256,
  conversationMessageTailDeletionConfirmationSha256,
  conversationRecentDeletionConfirmationSha256,
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
const truncateRouteSource = readFileSync(
  "app/api/threads/[thread_id]/messages/[message_id]/truncate/route.ts",
  "utf8",
);
const chatRouteSource = readFileSync("app/api/chat/route.ts", "utf8");
const deleteAllRouteSource = readFileSync(
  "app/api/admin/delete_all/route.ts",
  "utf8",
);
const forgetRecentRouteSource = readFileSync(
  "app/api/admin/forget_recent/route.ts",
  "utf8",
);
const adminErasureSource = readFileSync(
  "app/api/_brains/conversationErasureRequest.ts",
  "utf8",
);
const securityPanelSource = readFileSync(
  "components/admin/SecurityPanel.tsx",
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

test("message-tail erasure confirmation matches the governed-memory Python contract", () => {
  assert.equal(
    conversationMessageTailDeletionConfirmationSha256(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ),
    "fcb914c1a21dfddc19656ed7be3ccef7b020e723cbfe365a66b230bd6ccf77ef",
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

test("message edit truncation uses the governed chat-only erasure coordinator", () => {
  assert.match(truncateRouteSource, /getThreadUserId/);
  assert.match(truncateRouteSource, /threadBelongsToUser/);
  assert.match(truncateRouteSource, /Authorization|authorization/);
  assert.match(truncateRouteSource, /executeAdminConversationErasure/);
  assert.match(truncateRouteSource, /selectorKind: "message_tail"/);
  assert.match(truncateRouteSource, /threadId/);
  assert.match(truncateRouteSource, /anchorMessageId: messageId/);
  assert.match(truncateRouteSource, /operationId: messageId/);
  assert.doesNotMatch(
    truncateRouteSource,
    /`\$\{BRAINS\}\/threads\/\$\{encodeURIComponent\(tid\)\}/,
  );
});

test("stored chat forwards its canonical message id for Zep metadata mapping", () => {
  assert.match(chatRouteSource, /storedMessageId = String\(logged\?\.id/);
  assert.match(chatRouteSource, /message_id: storedMessageId/);
  assert.match(chatRouteSource, /attachment_message_id: storedMessageId/);
  assert.match(chatRouteSource, /Transcript binding unavailable/);
});

test("admin deletion confirmations match the governed-memory Python contract", () => {
  const operationId = "11111111-1111-4111-8111-111111111111";
  assert.equal(
    conversationAllDeletionConfirmationSha256(operationId),
    "582f2c97074d9d892fbb6c55457a715c064ba78c4e26769893186a3590234367",
  );
  assert.equal(
    conversationRecentDeletionConfirmationSha256(operationId, 3600),
    "b1f4ab45159ec2ade8eb93d0db706128d298b35552beabb11d0fc23a21a6a349",
  );
  assert.equal(
    conversationRecentDeletionConfirmationSha256(operationId, 86400),
    "66cfd0075117286418713fe71820cc8994a37934909ee99c2f6993bb5264b6de",
  );
});

test("admin deletion routes use only the governed chat-erasure coordinator", () => {
  for (const source of [deleteAllRouteSource, forgetRecentRouteSource]) {
    assert.match(source, /requireFreshCapability/);
    assert.match(source, /authorization/);
    assert.match(source, /executeAdminConversationErasure/);
    assert.doesNotMatch(source, /\/user\/\$\{encodeURIComponent\(user_id\)\}/);
    assert.doesNotMatch(source, /method: "DELETE"/);
  }
  assert.match(deleteAllRouteSource, /selectorKind: "all_conversations"/);
  assert.match(forgetRecentRouteSource, /selectorKind: "recent"/);
  assert.match(forgetRecentRouteSource, /recentWindowSeconds: minutes \* 60/);
  assert.match(
    adminErasureSource,
    /ERASURE_REQUEST_PATH = "\/memory\/conversations\/erasure-requests"/,
  );
  assert.match(adminErasureSource, /method: "POST"/);
  assert.match(adminErasureSource, /method: "GET"/);
  assert.match(adminErasureSource, /Authorization: authorization/);
  assert.match(adminErasureSource, /status\.state === "completed"/);
});

test("recent-deletion UI exposes only governed contract windows and refreshes after completion", () => {
  assert.match(
    securityPanelSource,
    /<option value=\{60\}>Last 1 hour<\/option>/,
  );
  assert.match(
    securityPanelSource,
    /<option value=\{1440\}>Last 24 hours<\/option>/,
  );
  assert.match(
    securityPanelSource,
    /<option value=\{10080\}>Last 7 days<\/option>/,
  );
  assert.match(
    securityPanelSource,
    /<option value=\{43200\}>Last 30 days<\/option>/,
  );
  assert.doesNotMatch(securityPanelSource, /<option value=\{15\}>/);
  assert.doesNotMatch(securityPanelSource, /<option value=\{240\}>/);
  assert.match(securityPanelSource, /minutes === 10080/);
  assert.match(securityPanelSource, /minutes === 43200/);
  assert.equal(
    securityPanelSource.match(/window\.location\.reload\(\)/g)?.length,
    2,
  );
});
