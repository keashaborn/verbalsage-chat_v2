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
  assert.match(preferences, /CONVERSATION_STYLE_OPTIONS\.map/);
  assert.match(preferences, /normalizeConversationStyle/);
  assert.doesNotMatch(preferences, /label="Friendliness"/);
});

test("primary response preference selects stay short and direct", () => {
  const preferences = source("components/settings/AssistantPreferences.tsx");

  assert.match(preferences, /label="Response length"/);
  assert.match(preferences, /RESPONSE_LENGTH_OPTIONS\.map/);
  assert.doesNotMatch(preferences, /label="Response length"[\s\S]{0,180}description=/);
});

test("assistant name is optional, account-scoped, and narrowly validated", () => {
  const preferences = source("components/settings/AssistantPreferences.tsx");
  const api = source("app/api/user/assistant-preferences/route.ts");

  assert.match(preferences, /label="Assistant name"/);
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
  const shared = source("app/api/user/assistant-preferences/_shared.ts");
  const authGate = source("components/auth/AuthGate.tsx");

  assert.match(preferences, /\/api\/user\/assistant-preferences/);
  assert.doesNotMatch(preferences, /\/api\/user\/instructions/);
  assert.match(api, /method: "GET" \| "PUT"/);
  assert.doesNotMatch(api, /RESSE_USER_PREFERENCES/);
  assert.doesNotMatch(api, /vantage_id/);
  assert.doesNotMatch(preferences, /supabase\.auth\.updateUser/);
  assert.match(shared, /getSupabaseBearerAuthorizationFromRequest/);
  assert.match(shared, /authorization: context\.authorization/);
  assert.match(shared, /brainsUpstreamHeaders\(context\.rid, context\.owner/);
  assert.doesNotMatch(api, /service_token_owner_override/);
  assert.doesNotMatch(preferences, /vs_conversation_style/);
  assert.match(authGate, /\/api\/user\/assistant-preferences/);
  assert.doesNotMatch(authGate, /md\.vs_conversation_style/);
});

test("guided response preferences use review then explicit apply", () => {
  const preferences = source("components/settings/AssistantPreferences.tsx");
  const compile = source("app/api/user/assistant-preferences/compile/route.ts");
  const approve = source("app/api/user/assistant-preferences/approve/route.ts");

  assert.match(preferences, /label="Your preferences"/);
  assert.match(preferences, /What will change/);
  assert.match(preferences, /Not applied/);
  assert.match(preferences, /Nothing changes until you apply this review/);
  assert.match(preferences, /Review preferences/);
  assert.match(preferences, /Apply preferences/);
  assert.match(preferences, /MAX_PREFERENCE_NARRATIVE_CHARS = 8000/);
  assert.match(preferences, /maxLength=\{MAX_PREFERENCE_NARRATIVE_CHARS\}/);
  assert.match(
    preferences,
    /Response preferences cannot control tools, memory ownership, retrieval, safety, or system policy/,
  );
  assert.match(compile, /MAX_PREFERENCE_NARRATIVE_CHARS = 8000/);
  assert.match(preferences, /\/api\/user\/assistant-preferences\/compile/);
  assert.match(preferences, /\/api\/user\/assistant-preferences\/approve/);
  assert.match(compile, /expected_revision/);
  assert.match(compile, /narrative/);
  assert.match(approve, /candidate_id/);
  assert.match(approve, /expected_revision/);
  assert.doesNotMatch(preferences, /Sage Helper/);
  assert.doesNotMatch(preferences, /rounded-2xl/);
});

test("primary response controls remain simple and advanced controls are tucked away", () => {
  const preferences = source("components/settings/AssistantPreferences.tsx");

  const primaryStart = preferences.indexOf("response-preferences-title");
  const advancedStart = preferences.indexOf("<details");
  assert.ok(primaryStart >= 0);
  assert.ok(advancedStart > primaryStart);
  assert.ok(
    preferences.indexOf('label="Conversation style"', primaryStart) <
      advancedStart,
  );
  assert.ok(
    preferences.indexOf('label="Response length"', primaryStart) <
      advancedStart,
  );
  assert.ok(
    preferences.indexOf('label="Technical depth"', advancedStart) >
      advancedStart,
  );
  assert.ok(
    preferences.indexOf('label="Format"', advancedStart) > advancedStart,
  );
  assert.match(preferences, />\s*Advanced\s*</);
});

test("TTS accepts only the fixed conversation-style boundary", () => {
  const route = source("app/api/tts/route.ts");
  const styles = source("lib/conversationStyle.ts");
  const callers = [
    source("components/lifeswitch/helper/LifeSwitchHelper.tsx"),
    source("components/admin/VoicePanel.tsx"),
    source("components/threads/BrainsChatPane.tsx"),
    source("components/assistant-ui/thread.tsx"),
  ];

  assert.match(route, /conversationStyleFromTtsRequest/);
  assert.match(route, /unsupported_tts_conversation_style/);
  assert.match(route, /conversation_style: conversationStyle/);
  assert.doesNotMatch(route, /instructions:\s*body/);
  assert.match(styles, /conversationStyleFromTtsRequest/);
  assert.match(styles, /instructions === conversationStyleTtsInstructions/);
  assert.match(styles, /return null/);
  for (const caller of callers) {
    assert.match(caller, /conversation_style:/);
    assert.doesNotMatch(caller, /conversationStyleTtsInstructions/);
    assert.doesNotMatch(caller, /\binstructions[:,]/);
  }
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
