import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import * as intake from "../lib/chatAttachmentIntakeV1.ts";

const {
  CHAT_ATTACHMENT_FILE_ACCEPT,
  MAX_CHAT_ATTACHMENT_BYTES,
  MAX_CHAT_ATTACHMENT_TOTAL_BYTES,
  chatAttachmentMediaTypeForFilename,
  validateChatAttachmentIntakeV1,
} = intake;

function validate(
  filename: string,
  byteSize: number,
  currentCount = 0,
  currentTotalBytes = 0,
) {
  return validateChatAttachmentIntakeV1({
    filename,
    byteSize,
    currentCount,
    currentTotalBytes,
  });
}

test("publishes the bounded TXT and Markdown intake contract", () => {
  assert.equal(MAX_CHAT_ATTACHMENT_BYTES, 73_728);
  assert.equal(MAX_CHAT_ATTACHMENT_TOTAL_BYTES, 73_728);
  assert.equal(CHAT_ATTACHMENT_FILE_ACCEPT, ".txt,.md,text/plain,text/markdown");
  assert.equal(chatAttachmentMediaTypeForFilename("notes.txt"), "text/plain");
  assert.equal(chatAttachmentMediaTypeForFilename("PLAN.MD"), "text/markdown");
  assert.equal(chatAttachmentMediaTypeForFilename("report.pdf"), null);
});

test("accepts exact individual and aggregate boundaries", () => {
  assert.deepEqual(validate("notes.txt", MAX_CHAT_ATTACHMENT_BYTES), {
    ok: true,
    mediaType: "text/plain",
  });
  assert.deepEqual(
    validate("notes.md", 1, 3, MAX_CHAT_ATTACHMENT_TOTAL_BYTES - 1),
    { ok: true, mediaType: "text/markdown" },
  );
});

test("denies unsupported, unsafe, empty, oversized, excessive, and aggregate input", () => {
  const denied = [
    validate("report.pdf", 10),
    validate("unsafe/name.txt", 10),
    validate("empty.txt", 0),
    validate("large.txt", MAX_CHAT_ATTACHMENT_BYTES + 1),
    validate("fifth.txt", 1, 4),
    validate("combined.md", 2, 1, MAX_CHAT_ATTACHMENT_TOTAL_BYTES - 1),
  ];
  for (const result of denied) {
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.error.length > 0);
  }
});

test("fails closed on invalid numeric state", () => {
  assert.equal(validate("notes.txt", Number.NaN).ok, false);
  assert.equal(validate("notes.txt", 1, -1).ok, false);
  assert.equal(validate("notes.txt", 1, 0, -1).ok, false);
});
