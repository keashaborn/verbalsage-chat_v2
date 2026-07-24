import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { voiceErrorMessage } from "../lib/voiceError.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hook = fs.readFileSync(
  path.join(root, "hooks/useGovernedVoiceConversation.ts"),
  "utf8",
);
const chatPane = fs.readFileSync(
  path.join(root, "components/threads/BrainsChatPane.tsx"),
  "utf8",
);

test("Safari permission denial is converted to an actionable message", () => {
  const result = voiceErrorMessage({
    name: "NotAllowedError",
    message:
      "The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.",
  });

  assert.equal(
    result,
    "Microphone access is blocked. Allow microphone access in your browser’s website settings, then try again.",
  );
  assert.doesNotMatch(result, /user agent|platform|current context/i);
});

test("common microphone device failures are normalized", () => {
  assert.match(
    voiceErrorMessage({ name: "NotFoundError" }),
    /No microphone was found/,
  );
  assert.match(
    voiceErrorMessage({ name: "NotReadableError" }),
    /microphone could not be opened/,
  );
});

test("all governed conversation failure paths use the normalizer", () => {
  assert.match(
    hook,
    /failSession\(voiceErrorMessage\(error, "Continuous voice failed\."\)\)/,
  );
  assert.match(
    hook,
    /const message = voiceErrorMessage\(error, "Continuous voice failed\."\)/,
  );
});

test("voice failure is presented once with a short status label", () => {
  assert.match(chatPane, /const visibleRequestError =/);
  assert.match(chatPane, /voiceStatus === "error"[\s\S]*?"Voice unavailable"/);
  assert.match(chatPane, /<span>\{visibleRequestError\}<\/span>/);
  assert.match(
    chatPane,
    /if \(governedVoiceHasError\) governedVoice\.stop\(\)/,
  );
  assert.doesNotMatch(
    chatPane,
    /`Voice error: \$\{governedVoice\.lastError\}`/,
  );
});
