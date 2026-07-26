import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("personalization owns conversation style and voice", () => {
  const preferences = source("components/settings/AssistantPreferences.tsx");
  const accountMenu = source("components/nav/AccountMenu.tsx");
  const legacyVoicePage = source("app/settings/models-voice/page.tsx");

  assert.match(preferences, /Conversation style/);
  assert.match(preferences, /<VoicePanel \/>/);
  assert.doesNotMatch(preferences, /label="Encouragement"/);
  assert.doesNotMatch(accountMenu, />\s*Voice\s*</);
  assert.match(legacyVoicePage, /redirect\("\/settings\/assistant-profile"\)/);
});

test("conversation styles change presentation without enabling agreement", () => {
  const styles = source("lib/conversationStyle.ts");
  const api = source("app/api/user/instructions/route.ts");

  assert.match(styles, /"direct"/);
  assert.match(styles, /"natural"/);
  assert.match(styles, /"warm"/);
  assert.match(styles, /without becoming agreeable/);
  assert.match(api, /encouragement:\s*"neutral"/);
  assert.doesNotMatch(api, /\["minimal",\s*"neutral"\]/);
});

test("preview and message speech wrap raw PCM before browser playback", () => {
  const panel = source("components/admin/VoicePanel.tsx");
  const messageThread = source("components/assistant-ui/thread.tsx");
  const helper = source("components/lifeswitch/helper/LifeSwitchHelper.tsx");

  assert.match(panel, /speechResponseToWavBlob/);
  assert.match(messageThread, /speechResponseToWavBlob/);
  assert.match(helper, /speechResponseToWavBlob/);
});
