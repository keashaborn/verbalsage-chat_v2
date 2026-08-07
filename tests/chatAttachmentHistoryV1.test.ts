import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeChatAttachmentHistoryV1 } from "../lib/chatAttachmentHistoryV1.ts";

const attachment = {
  id: "8a72912d-3933-4eb1-b7ce-caf1db72e536",
  filename: "Pasted text 20260807-000036.md",
  media_type: "text/markdown",
  content_sha256:
    "a2ae3bc22acb2a3f741f40ad3f4c9ece869a4500619b315d5fce9cc70d8db9be",
  byte_size: 40_000,
  processing_status: "ready",
  deleted_at: null,
} as const;

test("normalizes array and unambiguous JSON-string history identically", () => {
  const expected = [attachment];
  assert.deepEqual(normalizeChatAttachmentHistoryV1(expected), expected);
  assert.deepEqual(
    normalizeChatAttachmentHistoryV1(JSON.stringify(expected)),
    expected,
  );
});

test("preserves removed attachment history with exact deletion metadata", () => {
  const removed = {
    ...attachment,
    processing_status: "deleted",
    deleted_at: "2026-08-07T05:22:53.000Z",
  } as const;
  assert.deepEqual(normalizeChatAttachmentHistoryV1([removed]), [removed]);
});

test("denies malformed, oversized, ambiguous, and non-array payloads", () => {
  assert.deepEqual(normalizeChatAttachmentHistoryV1("not-json"), []);
  assert.deepEqual(normalizeChatAttachmentHistoryV1("{}"), []);
  assert.deepEqual(normalizeChatAttachmentHistoryV1({ ...attachment }), []);
  assert.deepEqual(normalizeChatAttachmentHistoryV1(" ".repeat(16_385)), []);
  assert.deepEqual(
    normalizeChatAttachmentHistoryV1(
      `[{"id":"${attachment.id}","id":"${attachment.id}"}]`,
    ),
    [],
  );
  assert.deepEqual(
    normalizeChatAttachmentHistoryV1(
      JSON.stringify([{ ...attachment, nested: { unsafe: true } }]),
    ),
    [],
  );
});

test("denies invalid metadata, extra keys, excessive counts, and duplicate ids", () => {
  const invalidValues = [
    { ...attachment, id: attachment.id.toUpperCase() },
    { ...attachment, filename: "bad\nname.md" },
    { ...attachment, media_type: "application/pdf" },
    { ...attachment, content_sha256: "not-a-hash" },
    { ...attachment, byte_size: 49_153 },
    { ...attachment, processing_status: "processing" },
    { ...attachment, deleted_at: "2026-08-07T05:22:53.000Z" },
    { ...attachment, extra: "field" },
  ];
  for (const value of invalidValues) {
    assert.deepEqual(normalizeChatAttachmentHistoryV1([value]), []);
  }
  assert.deepEqual(
    normalizeChatAttachmentHistoryV1([attachment, attachment]),
    [],
  );
  assert.deepEqual(
    normalizeChatAttachmentHistoryV1(
      Array.from({ length: 5 }, (_, index) => ({
        ...attachment,
        id: `8a72912d-3933-4eb1-b7ce-caf1db72e53${index}`,
      })),
    ),
    [],
  );
});

test("BrainsChatPane normalizes untrusted history before replacing optimistic state", () => {
  const pane = readFileSync("components/threads/BrainsChatPane.tsx", "utf8");
  assert.match(pane, /normalizeChatAttachmentHistoryV1\(m\.attachments\)/);
  assert.match(pane, /type HistoryMsgWire = Omit<Msg, "attachments">/);
  assert.match(pane, /fetchJson<HistoryMsgWire\[]>/);
});
