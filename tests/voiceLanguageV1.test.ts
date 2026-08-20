import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_VOICE_LANGUAGE,
  VOICE_LANGUAGE_HEADER,
  VOICE_LANGUAGE_IDS,
  normalizeVoiceLanguage,
} from "../lib/voiceLanguage.ts";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("voice language catalog has one unique Auto detect plus 57 languages", () => {
  assert.equal(VOICE_LANGUAGE_IDS.length, 58);
  assert.equal(new Set(VOICE_LANGUAGE_IDS).size, VOICE_LANGUAGE_IDS.length);
  assert.equal(VOICE_LANGUAGE_IDS[0], "auto");
  for (const language of ["en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar"]) {
    assert.ok(VOICE_LANGUAGE_IDS.includes(language));
  }
});

test("invalid device preference fails safely to English", () => {
  assert.equal(DEFAULT_VOICE_LANGUAGE, "en");
  assert.equal(normalizeVoiceLanguage("ES"), "es");
  assert.equal(normalizeVoiceLanguage("unsupported"), "en");
});

test("browser boundary uses a dedicated strict voice language header", () => {
  assert.equal(VOICE_LANGUAGE_HEADER, "x-vs-voice-language");
  const transcription = source("app/api/voice/openai/transcribe/route.ts");
  const realtime = source("app/api/voice/realtime-preview/call/route.ts");
  const chat = source("app/api/chat/route.ts");

  assert.match(transcription, /invalid_or_missing_voice_language/);
  assert.match(realtime, /invalid_or_missing_voice_language/);
  assert.match(chat, /invalid_voice_language_context/);
});

test("voice panel exposes searchable account-synced language selection", () => {
  const panel = source("components/admin/VoicePanel.tsx");

  assert.match(panel, /Search languages/);
  assert.match(panel, /role="listbox"/);
  assert.match(panel, /vs_voice_language/);
  assert.match(panel, /updateUser/);
  assert.match(panel, /Language saved to your account\./);
});
