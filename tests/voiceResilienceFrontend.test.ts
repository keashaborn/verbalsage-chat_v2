import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("voice network stages have explicit bounded deadlines", () => {
  const deadlines = source("lib/requestDeadline.ts");
  assert.match(deadlines, /BROWSER_TRANSCRIPTION_TIMEOUT_MS = 70_000/);
  assert.match(deadlines, /BRAINS_RESPONSE_TIMEOUT_MS = 92_000/);
  assert.match(deadlines, /BROWSER_RESPONSE_TIMEOUT_MS = 95_000/);
  assert.match(deadlines, /TTS_SEGMENT_TIMEOUT_MS = 90_000/);
});

test("voice transcription is cancelled on stop and owned across tabs", () => {
  const hook = source("hooks/useGovernedVoiceConversation.ts");
  assert.match(hook, /transcriptionAbortRef\.current\?\.abort\(\)/);
  assert.match(hook, /VOICE_SESSION_OWNER_KEY/);
  assert.match(hook, /window\.addEventListener\("storage"/);
});

test("chat and voice proxies use sanitized deadline handling", () => {
  const chat = source("app/api/chat/route.ts");
  const transcribe = source("app/api/voice/openai/transcribe/route.ts");
  const tts = source("app/api/tts/route.ts");
  assert.match(chat, /requestDeadlineSignal/);
  assert.doesNotMatch(chat, /Route error:/);
  assert.match(transcribe, /transcription_timeout/);
  assert.doesNotMatch(transcribe, /detail: String\(error/);
  assert.match(tts, /TTS_SEGMENT_TIMEOUT_MS/);
  assert.doesNotMatch(tts, /detail: String\(e/);
});

test("chat failures recover inline instead of trapping Sending state", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(pane, /setRequestError/);
  assert.match(pane, /role="alert"/);
  assert.match(pane, /finally \{\s+setSending\(false\)/);
});
