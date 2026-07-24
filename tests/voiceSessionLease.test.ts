import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  VOICE_SESSION_HEADER,
  voiceSessionHeaders,
  voiceSessionIdFromRequest,
} from "../lib/voiceSession.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SESSION = "0fc3d70a-a6d0-4e55-9e39-20e060b416c8";

test("voice session header accepts only a canonical UUID", () => {
  const valid = voiceSessionIdFromRequest(
    new Request("https://lifeswitch.com/api/chat", {
      headers: { [VOICE_SESSION_HEADER]: SESSION.toUpperCase() },
    }),
  );
  assert.equal(valid.supplied, true);
  assert.equal(valid.value, SESSION);
  assert.deepEqual(voiceSessionHeaders(valid.value), {
    [VOICE_SESSION_HEADER]: SESSION,
  });

  const invalid = voiceSessionIdFromRequest(
    new Request("https://lifeswitch.com/api/chat", {
      headers: { [VOICE_SESSION_HEADER]: "not-a-uuid" },
    }),
  );
  assert.equal(invalid.supplied, true);
  assert.equal(invalid.value, null);
});

test("continuous voice acquires and heartbeats before microphone use", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "hooks/useGovernedVoiceConversation.ts"),
    "utf8",
  );
  const acquire = source.indexOf('"/api/voice/session/acquire"');
  const microphone = source.indexOf("navigator.mediaDevices.getUserMedia");
  assert.ok(acquire >= 0);
  assert.ok(microphone > acquire);
  assert.match(source, /"\/api\/voice\/session\/heartbeat"/);
  assert.match(source, /"\/api\/voice\/session\/release"/);
  assert.match(source, /\[VOICE_SESSION_HEADER\]: voiceSessionId/);
  assert.match(source, /stopForOwnershipLoss/);
});

test("all governed voice stages propagate the session lease", () => {
  const pane = fs.readFileSync(
    path.join(ROOT, "components/threads/BrainsChatPane.tsx"),
    "utf8",
  );
  const chat = fs.readFileSync(
    path.join(ROOT, "app/api/chat/route.ts"),
    "utf8",
  );
  const tts = fs.readFileSync(
    path.join(ROOT, "app/api/tts/route.ts"),
    "utf8",
  );
  const transcription = fs.readFileSync(
    path.join(ROOT, "app/api/voice/openai/transcribe/route.ts"),
    "utf8",
  );

  assert.match(pane, /voiceSessionId\?: string/);
  assert.match(pane, /\[VOICE_SESSION_HEADER\]: voiceSessionId/);
  for (const source of [chat, tts, transcription]) {
    assert.match(source, /voiceSessionIdFromRequest/);
    assert.match(source, /voiceSessionHeaders/);
  }
});

test("lease proxy derives owner only from authenticated capability", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "app/api/voice/session/[action]/route.ts"),
    "utf8",
  );
  assert.match(source, /requireCapability\(req, "voice\.transcription"\)/);
  assert.match(source, /payload\?\.sub/);
  assert.match(source, /"x-vs-owner-user-id": userId/);
  assert.doesNotMatch(source, /body\?\.owner_user_id/);
});
