import assert from "node:assert/strict";
import test from "node:test";

import {
  FIRST_SPEECH_SEGMENT_CHARACTERS,
  FOLLOWING_SPEECH_SEGMENT_CHARACTERS,
  splitForSpeech,
} from "../lib/voiceSpeech.ts";

function normalized(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

test("empty speech produces no requests", () => {
  assert.deepEqual(splitForSpeech(" \n\r "), []);
});

test("1,500-word answer is bounded and lossless", () => {
  const answer = Array.from(
    { length: 1_500 },
    (_, index) => `voiceword${String(index).padStart(4, "0")}`,
  ).join(" ");
  const chunks = splitForSpeech(answer);

  assert.ok(chunks.length > 1);
  assert.ok(chunks[0].length <= FIRST_SPEECH_SEGMENT_CHARACTERS);
  assert.ok(
    chunks
      .slice(1)
      .every((chunk) => chunk.length <= FOLLOWING_SPEECH_SEGMENT_CHARACTERS),
  );
  assert.equal(chunks.join(" "), normalized(answer));
});

test("a pathological overlong token is bounded without data loss", () => {
  const token = "x".repeat(5_000);
  const chunks = splitForSpeech(token);

  assert.ok(chunks.length > 1);
  assert.ok(chunks[0].length <= FIRST_SPEECH_SEGMENT_CHARACTERS);
  assert.ok(
    chunks
      .slice(1)
      .every((chunk) => chunk.length <= FOLLOWING_SPEECH_SEGMENT_CHARACTERS),
  );
  assert.equal(chunks.join(""), token);
});
