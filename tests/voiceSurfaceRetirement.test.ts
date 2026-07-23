import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

test("only governed batch transcription remains exposed", () => {
  assert.equal(
    existsSync(
      join(
        root,
        "app/api/voice/openai/transcription-webrtc-offer/route.ts",
      ),
    ),
    false,
  );
  assert.match(
    source("app/api/voice/openai/transcribe/route.ts"),
    /voice\.transcription/,
  );
  assert.doesNotMatch(
    source("app/api/voice/openai/transcribe/route.ts"),
    /voice\.realtime_token/,
  );
});

test("active conversation code contains no obsolete Realtime names", () => {
  const chat = source("components/threads/BrainsChatPane.tsx");
  const auth = source("components/auth/AuthGate.tsx");
  const permissions = source(
    "components/admin/settings/permissions/permissionRegistry.ts",
  );

  assert.match(chat, /useGovernedVoiceConversation/);
  assert.doesNotMatch(chat, /useGovernedRealtimeVoice/);
  assert.doesNotMatch(auth, /vs_realtime_voice/);
  assert.match(permissions, /voice\.transcription/);
  assert.doesNotMatch(permissions, /voice\.realtime_token/);
});
