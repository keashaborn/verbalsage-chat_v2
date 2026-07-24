import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("composer uses one contextual voice or send action", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(pane, /data-contextual-composer-action/);
  assert.match(pane, /composerHasText\s*\?\s*"Send message"/);
  assert.match(pane, /"Start voice conversation"/);
  assert.match(pane, /"End voice conversation"/);
  assert.match(pane, /handleComposerAction/);
  assert.match(pane, /<ArrowUp/);
  assert.match(pane, /<X/);
  assert.doesNotMatch(pane, />Talk</);
});

test("typed submission stops an active governed voice session first", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(
    pane,
    /if \(voiceIsActive \|\| voiceIsConnecting\) \{\s*await stopListeningAndRespond\(\)/,
  );
  assert.match(pane, /await sendMessage\(\)/);
});

test("active governed voice exposes a branded live status stage", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(pane, /voiceSessionVisible &&/);
  assert.match(pane, /className="vs-voice-watermark"/);
  assert.match(pane, /data-voice-state=\{voicePresentationState\}/);
  assert.match(pane, /role="status"/);
  assert.match(pane, /aria-live="polite"/);
});

test("voice visuals have bounded motion and a reduced-motion fallback", () => {
  const css = source("app/globals.css");
  assert.match(css, /@keyframes vs-voice-breathe/);
  assert.match(css, /@keyframes vs-voice-processing/);
  assert.match(css, /@keyframes vs-voice-reply/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none !important/);
});

test("watermark uses current high-resolution LifeSwitch symbol assets", () => {
  const light = readFileSync(
    new URL(
      "../public/brand/lifeswitch/voice-symbol-light-1024.png",
      import.meta.url,
    ),
  );
  const dark = readFileSync(
    new URL(
      "../public/brand/lifeswitch/voice-symbol-dark-1024.png",
      import.meta.url,
    ),
  );
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  assert.deepEqual(light.subarray(0, 4), pngSignature);
  assert.deepEqual(dark.subarray(0, 4), pngSignature);
  assert.ok(light.length > 10_000);
  assert.ok(dark.length > 10_000);
});
