import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const source = (relative: string) =>
  fs.readFileSync(path.join(ROOT, relative), "utf8");

test("preview capability is owner/admin/developer only", () => {
  const registry = source(
    "components/admin/settings/permissions/permissionRegistry.ts",
  );
  assert.match(registry, /key:\s*"voice\.realtime_preview"/);
  assert.match(
    registry,
    /key:\s*"voice\.realtime_preview"[\s\S]*?defaultRoles:\s*\["owner",\s*"admin",\s*"developer"\]/,
  );
});

test("settings keep governed voice default and expose the authorized preview", () => {
  const panel = source("components/admin/VoicePanel.tsx");
  const modes = source("lib/voiceMode.ts");
  assert.match(panel, /Conversation mode/);
  assert.match(modes, /Governed voice — Recommended/);
  assert.match(modes, /Realtime conversation — Preview/);
  assert.match(modes, /value:\s*"realtime_preview"[\s\S]*?enabled:\s*true/);
  assert.match(panel, /VOICE_MODE_STORAGE_KEY/);
  assert.match(panel, /normalizeVoiceMode/);
  assert.match(panel, /disabled=\{!option\.enabled\}/);
});

test("preview overlay hides transcript content", () => {
  const overlay = source("components/voice/RealtimeVoiceOverlay.tsx");
  assert.match(overlay, /data-realtime-state=\{state\}/);
  assert.match(overlay, /vs-realtime-orb__symbol--front/);
  assert.match(overlay, /vs-realtime-orb__symbol--back/);
  assert.doesNotMatch(overlay, /transcript\s*:/i);
  assert.match(overlay, /AI-generated voice/);
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

test("chat selects preview explicitly while governed voice remains available", () => {
  const chat = source("components/threads/BrainsChatPane.tsx");
  assert.match(chat, /useGovernedVoiceConversation/);
  assert.match(chat, /useRealtimeVoicePreview/);
  assert.match(chat, /voiceMode === "realtime_preview"\s*&&\s*isAdmin/);
  assert.match(chat, /RealtimeVoiceOverlay/);
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
  assert.match(hook, /echoCancellation:\s*true/);
  assert.match(hook, /assistantSpeakingRef/);
  assert.match(hook, /onSpeechStartRef\.current\?\.\(\)/);
  assert.match(hook, /setAssistantSpeaking/);
  assert.doesNotMatch(hook, /response\.cancel/);
  assert.doesNotMatch(hook, /conversation\.item\.truncate/);
});
