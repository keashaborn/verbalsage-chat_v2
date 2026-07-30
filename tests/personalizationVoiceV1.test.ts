import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("personalization and voice are separate account settings", () => {
  const preferences = source("components/settings/AssistantPreferences.tsx");
  const accountMenu = source("components/nav/AccountMenu.tsx");
  const legacyVoicePage = source("app/settings/models-voice/page.tsx");
  const legacyPersonalizationVoicePage = source(
    "app/personalization/voice/page.tsx",
  );
  const voicePage = source("app/settings/voice/page.tsx");

  assert.match(preferences, /Conversation style/);
  assert.doesNotMatch(preferences, /<VoicePanel \/>/);
  assert.doesNotMatch(preferences, /label="Encouragement"/);
  assert.match(accountMenu, /href="\/settings\/voice"/);
  assert.match(accountMenu, />\s*Voice\s*</);
  assert.match(voicePage, /<VoicePanel \/>/);
  assert.match(legacyVoicePage, /redirect\("\/settings\/voice"\)/);
  assert.match(
    legacyPersonalizationVoicePage,
    /redirect\("\/settings\/voice"\)/,
  );
});

test("conversation styles change presentation without enabling agreement", () => {
  const styles = source("lib/conversationStyle.ts");
  const preferences = source("components/settings/AssistantPreferences.tsx");

  assert.match(styles, /"direct"/);
  assert.match(styles, /"natural"/);
  assert.match(styles, /"warm"/);
  assert.match(styles, /without becoming agreeable/);
  assert.match(preferences, /CONVERSATION_STYLE_OPTIONS\.find/);
  assert.match(preferences, /\?\.description/);
  assert.doesNotMatch(preferences, /label="Friendliness"/);
});

test("assistant name is optional, account-scoped, and narrowly validated", () => {
  const preferences = source("components/settings/AssistantPreferences.tsx");
  const api = source("app/api/user/assistant-preferences/route.ts");

  assert.match(preferences, />\s*Assistant name\s*</);
  assert.match(preferences, /typed and voice conversations/);
  assert.match(preferences, /maxLength=\{40\}/);
  assert.match(api, /assistant-preferences/);
  assert.match(api, /expected_revision/);
  assert.doesNotMatch(api, /memory_raw/);
  assert.doesNotMatch(api, /\/cards\//);
  assert.doesNotMatch(api, /vs_assistant_name/);
});

test("personalization no longer uses legacy instruction cards", () => {
  const preferences = source("components/settings/AssistantPreferences.tsx");
  const api = source("app/api/user/assistant-preferences/route.ts");
  const authGate = source("components/auth/AuthGate.tsx");

  assert.match(preferences, /\/api\/user\/assistant-preferences/);
  assert.doesNotMatch(preferences, /\/api\/user\/instructions/);
  assert.match(api, /method: "GET" \| "PUT"/);
  assert.doesNotMatch(api, /RESSE_USER_PREFERENCES/);
  assert.doesNotMatch(api, /vantage_id/);
  assert.doesNotMatch(preferences, /supabase\.auth\.updateUser/);
  assert.doesNotMatch(preferences, /vs_conversation_style/);
  assert.match(authGate, /\/api\/user\/assistant-preferences/);
  assert.doesNotMatch(authGate, /md\.vs_conversation_style/);
});

test("preview and message speech wrap raw PCM before browser playback", () => {
  const panel = source("components/admin/VoicePanel.tsx");
  const messageThread = source("components/assistant-ui/thread.tsx");
  const helper = source("components/lifeswitch/helper/LifeSwitchHelper.tsx");

  assert.match(panel, /speechResponseToWavBlob/);
  assert.match(messageThread, /speechResponseToWavBlob/);
  assert.match(helper, /speechResponseToWavBlob/);
});

test("voice settings present a capability-filtered identity carousel", () => {
  const panel = source("components/admin/VoicePanel.tsx");
  const speech = source("lib/speechSettings.ts");

  assert.match(panel, /aria-roledescription="carousel"/);
  assert.match(panel, /Swipe the symbol or use the arrows/);
  assert.match(panel, /aria-label="Previous voice"/);
  assert.match(panel, /aria-label="Next voice"/);
  assert.match(panel, /event\.key === "ArrowLeft"/);
  assert.match(panel, /event\.key === "ArrowRight"/);
  assert.match(panel, /Math\.abs\(horizontalDistance\) < 40/);
  assert.match(panel, /selectAndPreview\(visibleVoices\[nextIndex\]\)/);
  assert.match(panel, /aria-current=/);
  assert.match(panel, /void previewVoice\(persistedVoice\)/);
  assert.match(panel, /previewAbortRef\.current\?\.abort\(\)/);
  assert.match(
    panel,
    /accountSyncRef\.current = accountSyncRef\.current\.then/,
  );
  assert.match(panel, /sequence !== accountSyncSequenceRef\.current/);
  assert.match(panel, /Language/);
  assert.match(panel, /languageOptions/);
  assert.match(panel, /Search languages/);
  assert.match(panel, /role="listbox"/);
  assert.match(panel, /recommended_voices/);
  assert.doesNotMatch(panel, /Preview \$\{selected\.label\}/);
  assert.doesNotMatch(panel, /Expressive, reliable speech/);
  assert.doesNotMatch(panel, /Clear and natural/);
  assert.doesNotMatch(panel, />Automatic</);
  assert.doesNotMatch(panel, /Hi, I’m RESSE/);
  for (const voice of [
    "marin",
    "cedar",
    "alloy",
    "ash",
    "ballad",
    "coral",
    "echo",
    "fable",
    "nova",
    "onyx",
    "sage",
    "shimmer",
    "verse",
  ]) {
    assert.match(speech, new RegExp(`"${voice}"`));
  }
});
