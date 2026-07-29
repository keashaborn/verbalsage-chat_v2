import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const source = (relative: string) =>
  fs.readFileSync(path.join(ROOT, relative), "utf8");

test("live voice capability is available to authenticated product roles", () => {
  const registry = source(
    "components/admin/settings/permissions/permissionRegistry.ts",
  );
  assert.match(registry, /key:\s*"voice\.realtime_preview"/);
  assert.match(
    registry,
    /key:\s*"voice\.realtime_preview"[\s\S]*?defaultRoles:\s*\[\s*"owner",\s*"admin",\s*"developer",\s*"operator",\s*"beta_tester",\s*"power_user",\s*"user",?\s*\]/,
  );
});

test("settings expose one server-owned speech model and the compatible voice catalog", () => {
  const panel = source("components/admin/VoicePanel.tsx");
  const speech = source("lib/speechSettings.ts");
  const chat = source("components/threads/BrainsChatPane.tsx");
  assert.doesNotMatch(panel, /Conversation mode|Speech model|Speed/);
  assert.match(panel, /Preview/);
  assert.match(speech, /SPEECH_MODEL = "gpt-4o-mini-tts"/);
  assert.match(speech, /"marin"/);
  assert.match(speech, /"cedar"/);
  assert.match(speech, /"alloy"/);
  assert.match(speech, /"verse"/);
  assert.match(chat, /"realtime_preview"/);
  assert.match(chat, /app_metadata\?\.role/);
});

test("live overlay keeps captions optional", () => {
  const overlay = source("components/voice/RealtimeVoiceOverlay.tsx");
  const chat = source("components/threads/BrainsChatPane.tsx");
  assert.match(overlay, /data-realtime-state=\{state\}/);
  assert.match(overlay, /vs-realtime-orb__symbol--front/);
  assert.match(overlay, /vs-realtime-orb__symbol--back/);
  assert.match(overlay, />\s*CC\s*</);
  assert.match(overlay, /captionsEnabled && caption\?\.text/);
  assert.match(overlay, /AI-generated voice/);
  assert.match(chat, /speaker:\s*"You"\s*\|\s*"Assistant"/);
  assert.match(chat, /speaker:\s*"Assistant",\s*text:\s*turn\.answer/);
  assert.doesNotMatch(overlay, /RESSE/);
  assert.doesNotMatch(chat, /speaker:\s*"RESSE"/);
});

test("preview overlay motion is state-aware and accessibility bounded", () => {
  const styles = source("app/globals.css");
  assert.match(styles, /@keyframes vs-realtime-orb-turn/);
  assert.match(styles, /@keyframes vs-realtime-orb-speak/);
  assert.match(styles, /data-realtime-state="connecting"/);
  assert.match(styles, /data-realtime-state="processing"/);
  assert.match(styles, /data-realtime-state="speaking"/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.vs-realtime-orb/,
  );
});

test("browser route requires fresh capability and forwards only to Brains", () => {
  const route = source("app/api/voice/realtime-preview/call/route.ts");
  assert.match(route, /requireFreshCapability/);
  assert.match(route, /"voice\.realtime_preview"/);
  assert.match(route, /\/voice\/realtime-preview\/call/);
  assert.match(route, /voiceSessionIdFromRequest/);
  assert.match(route, /x-vs-thread-id/);
  assert.doesNotMatch(route, /OPENAI_API_KEY/);
  assert.doesNotMatch(route, /api\.openai\.com/);
  assert.doesNotMatch(route, /v1\/realtime\/calls/);

  const closeRoute = source(
    "app/api/voice/realtime-preview/session/[sessionId]/route.ts",
  );
  assert.match(closeRoute, /requireFreshCapability/);
  assert.match(closeRoute, /"voice\.realtime_preview"/);
  assert.match(closeRoute, /method:\s*"GET"/);
  assert.match(closeRoute, /\/events\?after=/);
  assert.match(closeRoute, /method:\s*"DELETE"/);
  assert.doesNotMatch(closeRoute, /OPENAI_API_KEY/);

  const commitRoute = source(
    "app/api/voice/realtime-preview/session/[sessionId]/commit/route.ts",
  );
  assert.match(commitRoute, /requireFreshCapability/);
  assert.match(commitRoute, /"voice\.realtime_preview"/);
  assert.match(commitRoute, /\/commit/);
  assert.match(commitRoute, /method:\s*"POST"/);
  assert.doesNotMatch(commitRoute, /OPENAI_API_KEY/);
  assert.doesNotMatch(commitRoute, /api\.openai\.com/);
});

test("preview controller uses WebRTC audio but only governed BFF answers", () => {
  const hook = source("hooks/useRealtimeVoicePreview.ts");
  assert.match(hook, /getUserMedia/);
  assert.match(hook, /RTCPeerConnection/);
  assert.match(hook, /\/api\/voice\/realtime-preview\/call/);
  assert.match(hook, /x-vs-thread-id/);
  assert.match(hook, /\/commit/);
  assert.match(hook, /\?after=\$\{eventCursorRef\.current\}/);
  assert.match(hook, /response\.completed/);
  assert.match(hook, /voiceSessionId/);
  assert.doesNotMatch(hook, /OPENAI_API_KEY/);
  assert.doesNotMatch(hook, /api\.openai\.com/);
  assert.doesNotMatch(hook, /\/api\/chat/);
  assert.doesNotMatch(hook, /\/vantage\/query/);
});

test("chat uses clean live voice while governed rollback code remains available", () => {
  const chat = source("components/threads/BrainsChatPane.tsx");
  assert.match(chat, /useGovernedVoiceConversation/);
  assert.match(chat, /useRealtimeVoicePreview/);
  assert.match(
    chat,
    /useState<"realtime_preview" \| "governed">\(\s*"realtime_preview"/,
  );
  assert.match(chat, /RealtimeVoiceOverlay/);
  assert.match(chat, /onTranscript:/);
  assert.match(chat, /vs_voice_captions/);
  assert.match(chat, /requestAutoTitle\(tid\)/);
  assert.match(chat, /turn\.voiceSessionId/);
  assert.match(chat, /realtimeVoice\.setAssistantSpeaking\(true\)/);
  assert.match(chat, /onSpeechStart:/);
  assert.match(chat, /stopTTS\(\)/);
  assert.doesNotMatch(chat, /useStreamingVoicePreview/);
  assert.doesNotMatch(chat, /\/api\/chat.*realtime/i);
});

test("preview barge-in is local, sustained, and echo guarded", () => {
  const hook = source("hooks/useRealtimeVoicePreview.ts");
  assert.match(hook, /BARGE_IN_START_RMS\s*=\s*0\.06/);
  assert.match(hook, /BARGE_IN_HOLD_MS\s*=\s*180/);
  assert.match(hook, /NORMAL_END_SILENCE_MS\s*=\s*1_200/);
  assert.match(hook, /BARGE_IN_END_SILENCE_MS\s*=\s*1_800/);
  assert.match(hook, /turnStartedAsBargeInRef/);
  assert.match(
    hook,
    /turnStartedAsBargeInRef\.current\s*\?\s*BARGE_IN_END_SILENCE_MS\s*:\s*NORMAL_END_SILENCE_MS/,
  );
  assert.match(hook, /echoCancellation:\s*true/);
  assert.match(hook, /assistantSpeakingRef/);
  assert.match(hook, /onSpeechStartRef\.current\?\.\(\)/);
  assert.match(hook, /setAssistantSpeaking/);
  assert.doesNotMatch(hook, /response\.cancel/);
  assert.doesNotMatch(hook, /conversation\.item\.truncate/);
});
