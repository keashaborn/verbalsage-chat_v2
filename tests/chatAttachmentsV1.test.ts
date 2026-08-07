import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatRoute = readFileSync("app/api/chat/route.ts", "utf8");
const attachmentRoute = readFileSync(
  "app/api/chat/attachments/route.ts",
  "utf8",
);
const pane = readFileSync("components/threads/BrainsChatPane.tsx", "utf8");
const intake = readFileSync("lib/chatAttachmentIntakeV1.ts", "utf8");

test("attachment proxy derives fresh owner identity and verifies exact hash", () => {
  assert.match(attachmentRoute, /getFreshSupabaseAuthContextFromRequest\(req\)/);
  assert.match(attachmentRoute, /contentSha256 !== exactHash/);
  assert.match(
    attachmentRoute,
    /import \{ MAX_CHAT_ATTACHMENT_BYTES \} from "@\/lib\/chatAttachmentIntakeV1"/,
  );
  assert.match(attachmentRoute, /raw\.length > MAX_CHAT_ATTACHMENT_BYTES/);
  assert.match(attachmentRoute, /user_id: auth\.user_id/);
  assert.doesNotMatch(attachmentRoute, /body\?\.user_id/);
});

test("attachment turns bind to transcript and bypass automatic web search", () => {
  assert.match(chatRoute, /attachment_ids: attachmentIds/);
  assert.match(chatRoute, /attachment_message_id: attachmentMessageId/);
  assert.match(
    chatRoute,
    /automaticSearchAuthorized && attachmentIds\.length === 0/,
  );
  assert.match(chatRoute, /Attachments require stored text chat/);
});

test("oversized paste creates bounded removable attachment UI", () => {
  assert.match(pane, /LARGE_PASTE_ATTACHMENT_BYTES = 8_192/);
  assert.match(intake, /MAX_CHAT_ATTACHMENT_BYTES = 73_728/);
  assert.match(intake, /MAX_CHAT_ATTACHMENT_TOTAL_BYTES = 73_728/);
  assert.match(pane, /onPaste=\{\(event\) => void handleComposerPaste\(event\)\}/);
  assert.match(pane, /Remove \$\{attachment\.filename\}/);
  assert.match(pane, />\s*Retry\s*</);
  assert.match(pane, /content_sha256: attachment\.contentSha256/);
});

test("composer exposes bounded TXT and Markdown picker and desktop drop intake", () => {
  assert.match(pane, /type="file"/);
  assert.match(pane, /accept=\{CHAT_ATTACHMENT_FILE_ACCEPT\}/);
  assert.match(pane, /aria-label="Add TXT or Markdown attachment"/);
  assert.match(pane, /onDragEnter=\{handleAttachmentDragEnter\}/);
  assert.match(pane, /onDragOver=\{handleAttachmentDragOver\}/);
  assert.match(pane, /onDragLeave=\{handleAttachmentDragLeave\}/);
  assert.match(pane, /onDrop=\{handleAttachmentDrop\}/);
  assert.match(pane, /new TextDecoder\("utf-8", \{/);
  assert.match(pane, /fatal: true/);
  assert.match(pane, /ignoreBOM: true/);
});
