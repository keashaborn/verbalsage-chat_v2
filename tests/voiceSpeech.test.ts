import assert from "node:assert/strict";
import test from "node:test";

import {
  FIRST_SPEECH_SEGMENT_CHARACTERS,
  FOLLOWING_SPEECH_SEGMENT_CHARACTERS,
  pcmS16leToWav,
  shouldUseNativeSafariAudio,
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

test("Safari uses native audio while Chromium does not", () => {
  assert.equal(
    shouldUseNativeSafariAudio("Mozilla/5.0 Version/26.5.2 Safari/605.1.15"),
    true,
  );
  assert.equal(
    shouldUseNativeSafariAudio("Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36"),
    false,
  );
  assert.equal(
    shouldUseNativeSafariAudio(
      "Mozilla/5.0 CriOS/140.0 Mobile/15E148 Safari/604.1",
    ),
    false,
  );
});

test("PCM is wrapped as a valid mono 24 kHz WAV", () => {
  const pcm = new Uint8Array([0, 0, 255, 127, 0, 128]);
  const wav = pcmS16leToWav(pcm);
  const view = new DataView(wav.buffer);

  assert.equal(new TextDecoder().decode(wav.slice(0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(wav.slice(8, 12)), "WAVE");
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 24_000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), pcm.byteLength);
  assert.deepEqual(wav.slice(44), pcm);
});

test("incomplete PCM samples fail closed", () => {
  assert.throws(
    () => pcmS16leToWav(new Uint8Array([1])),
    /complete 16-bit samples/,
  );
});
