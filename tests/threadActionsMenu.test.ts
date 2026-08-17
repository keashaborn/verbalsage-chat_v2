import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const listSource = readFileSync(
  "components/threads/BrainsThreadList.tsx",
  "utf8",
);
const paneSource = readFileSync(
  "components/threads/BrainsChatPane.tsx",
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
const clearAllHistoryRouteSource = readFileSync(
  "app/api/admin/clear_chat_history/route.ts",
  "utf8",
);
const chatHistoryClearSource = readFileSync(
  "app/api/_brains/chatHistoryClearRequest.ts",
  "utf8",
);
const fullAiDataClearSource = readFileSync(
  "app/api/_brains/fullAiDataClearRequest.ts",
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

test("thread deletion clears visible history while retaining memory", () => {
  assert.doesNotMatch(deleteRouteSource, /vs_tid|response\.cookies/);
  assert.match(deleteRouteSource, /executeChatHistoryClear/);
  assert.match(deleteRouteSource, /scope: "thread"/);
  assert.match(deleteRouteSource, /memory_retained: true/);
  assert.doesNotMatch(deleteRouteSource, /executeAdminConversationErasure/);
  assert.doesNotMatch(deleteRouteSource, /ERASURE_REQUEST_PATH/);
});

test("message edit truncation uses owner-scoped chat clearing and retains Zep", () => {
  assert.match(truncateRouteSource, /getThreadUserId/);
  assert.match(truncateRouteSource, /threadBelongsToUser/);
  assert.match(truncateRouteSource, /Authorization|authorization/);
  assert.match(truncateRouteSource, /executeChatHistoryClear/);
  assert.match(truncateRouteSource, /scope: "message_tail"/);
  assert.match(truncateRouteSource, /threadId/);
  assert.match(truncateRouteSource, /anchorMessageId: messageId/);
  assert.match(truncateRouteSource, /memory_retained: true/);
  assert.doesNotMatch(truncateRouteSource, /executeAdminConversationErasure/);
  assert.doesNotMatch(
    truncateRouteSource,
    /`\$\{BRAINS\}\/threads\/\$\{encodeURIComponent\(tid\)\}/,
  );
});

test("message editing exposes explicit save, cancel, and confirmed delete actions", () => {
  assert.match(paneSource, /aria-label="Edit message actions"/);
  assert.match(paneSource, /requestEditedMessageDeletion/);
  assert.match(paneSource, /cancelEditingMessage/);
  assert.match(paneSource, /\{sending \? "Saving…" : "Save"\}/);
  assert.match(paneSource, /disabled=\{sending \|\| !editingText\.trim\(\)\}/);
  assert.match(paneSource, /<DialogTitle>Delete this message\?<\/DialogTitle>/);
  assert.match(
    paneSource,
    /This message and every reply after it will be removed from this/,
  );
  assert.match(paneSource, /Saved and governed memory is not erased\./);
  assert.match(paneSource, /autoFocus/);
  assert.match(paneSource, /\{deletingMessage \? "Deleting…" : "Delete message"\}/);
  assert.doesNotMatch(paneSource, /window\.confirm/);
});

test("confirmed message deletion reuses truncation and removes the local message tail", () => {
  assert.match(paneSource, /async function deleteEditedMessage/);
  assert.match(
    paneSource,
    /await truncateThreadFromMessage\(target\.threadId, target\.messageId\)/,
  );
  assert.match(paneSource, /if \(threadId === target\.threadId\)/);
  assert.match(paneSource, /current\.slice\(0, index\)/);
  assert.match(paneSource, /setEditingMessageId\(null\)/);
  assert.match(paneSource, /setEditingText\(""\)/);
  assert.match(paneSource, /new Event\("vs_threads_refresh"\)/);
});

test("stored chat forwards its canonical message id for Zep metadata mapping", () => {
  assert.match(chatRouteSource, /storedMessageId = String\(logged\?\.id/);
  assert.match(chatRouteSource, /message_id: storedMessageId/);
  assert.match(chatRouteSource, /attachment_message_id: storedMessageId/);
  assert.match(chatRouteSource, /Transcript binding unavailable/);
});

test("admin routes separate retained history clearing from full erasure", () => {
  assert.match(deleteAllRouteSource, /requireFreshCapability/);
  assert.match(deleteAllRouteSource, /executeFullAiDataClear/);
  assert.doesNotMatch(deleteAllRouteSource, /executeAdminConversationErasure/);
  assert.match(deleteAllRouteSource, /memory_retained: false/);
  assert.match(deleteAllRouteSource, /zep_deleted: true/);
  for (const source of [forgetRecentRouteSource, clearAllHistoryRouteSource]) {
    assert.match(source, /requireFreshCapability/);
    assert.match(source, /authorization/);
    assert.match(source, /executeChatHistoryClear/);
    assert.doesNotMatch(source, /executeAdminConversationErasure/);
  }
  assert.match(clearAllHistoryRouteSource, /scope: "all"/);
  assert.match(forgetRecentRouteSource, /scope: "recent"/);
  assert.match(forgetRecentRouteSource, /recentWindowSeconds: minutes \* 60/);
  assert.match(
    chatHistoryClearSource,
    /CHAT_HISTORY_CLEAR_PATH = "\/chat-history\/clear"/,
  );
  assert.match(chatHistoryClearSource, /memory_retained !== true/);
  assert.match(chatHistoryClearSource, /zep_called !== false/);
  assert.match(
    fullAiDataClearSource,
    /FULL_AI_DATA_CLEAR_PATH = "\/memory\/chat-and-zep\/clear"/,
  );
  assert.match(fullAiDataClearSource, /method: "DELETE"/);
  assert.match(fullAiDataClearSource, /Authorization: authorization/);
  assert.match(fullAiDataClearSource, /memory_retained !== false/);
  assert.match(fullAiDataClearSource, /zep_called !== true/);
  assert.match(fullAiDataClearSource, /zep_deleted !== true/);
  assert.match(chatHistoryClearSource, /scope: "message_tail"/);
  assert.match(chatHistoryClearSource, /anchor_message_id/);
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
    3,
  );
});
