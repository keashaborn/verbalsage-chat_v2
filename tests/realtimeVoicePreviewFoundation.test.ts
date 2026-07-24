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

test("settings keep governed voice recommended and preview disabled", () => {
  const panel = source("components/admin/VoicePanel.tsx");
  const modes = source("lib/voiceMode.ts");
  assert.match(panel, /Conversation mode/);
  assert.match(modes, /Governed voice — Recommended/);
  assert.match(modes, /Realtime conversation — Preview/);
  assert.match(panel, /disabled=\{!option\.enabled\}/);
});

test("preview overlay hides transcript content", () => {
  const overlay = source("components/voice/RealtimeVoiceOverlay.tsx");
  assert.match(overlay, /voice-symbol-light-1024\.png/);
  assert.doesNotMatch(overlay, /transcript\s*:/i);
  assert.match(overlay, /AI-generated voice/);
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

test("production chat remains on the governed hook", () => {
  const chat = source("components/threads/BrainsChatPane.tsx");
  assert.match(chat, /useGovernedVoiceConversation/);
  assert.doesNotMatch(chat, /useStreamingVoicePreview/);
  assert.doesNotMatch(chat, /RealtimeVoiceOverlay/);
});
