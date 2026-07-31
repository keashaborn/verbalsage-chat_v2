import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatConversationTranscript,
  nextMessageSelection,
  selectAllMessageIndexes,
} from "../lib/conversationSelection.ts";

const messages = [
  { role: "user" as const, content: "First question" },
  { role: "assistant" as const, content: "First answer" },
  { role: "user" as const, content: "Second question" },
  { role: "assistant" as const, content: "Second answer" },
];

test("conversation copy preserves chronological role-labelled turns", () => {
  assert.equal(
    formatConversationTranscript(messages),
    [
      "You:\nFirst question",
      "Assistant:\nFirst answer",
      "You:\nSecond question",
      "Assistant:\nSecond answer",
    ].join("\n\n"),
  );
});

test("selected conversation copy ignores selection order and empty turns", () => {
  assert.equal(
    formatConversationTranscript(
      [...messages, { role: "assistant" as const, content: "   " }],
      [3, 1, 4],
    ),
    "Assistant:\nFirst answer\n\nAssistant:\nSecond answer",
  );
});

test("message selection toggles individual rows and extends ranges", () => {
  assert.deepEqual(nextMessageSelection([], 1, null, false, 4), [1]);
  assert.deepEqual(nextMessageSelection([1], 3, 1, true, 4), [1, 2, 3]);
  assert.deepEqual(nextMessageSelection([1, 2, 3], 2, 1, false, 4), [1, 3]);
  assert.deepEqual(nextMessageSelection([1], 8, 1, false, 4), [1]);
});

test("select all returns every available message index", () => {
  assert.deepEqual(selectAllMessageIndexes(4), [0, 1, 2, 3]);
  assert.deepEqual(selectAllMessageIndexes(-1), []);
});
