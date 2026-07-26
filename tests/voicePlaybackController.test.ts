import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pane = readFileSync(
  new URL("../components/threads/BrainsChatPane.tsx", import.meta.url),
  "utf8",
);

test("playback controller exposes compact essential controls", () => {
  assert.match(pane, /AI-generated voice playback/);
  assert.match(pane, /Resume voice playback/);
  assert.match(pane, /Pause voice playback/);
  assert.match(pane, /Stop and close voice playback/);
  assert.match(pane, /Voice playback position/);
  assert.doesNotMatch(pane, /Part \$\{playbackState\.segmentIndex/);
  assert.doesNotMatch(pane, /Go back 10 seconds|Go forward 10 seconds/);
});

test("player uses bounded, private browser-memory audio", () => {
  assert.match(pane, /withRequestDeadline\(/);
  assert.match(pane, /TTS_SEGMENT_TIMEOUT_MS/);
  assert.match(pane, /URL\.createObjectURL/);
  assert.match(pane, /URL\.revokeObjectURL/);
  assert.doesNotMatch(pane, /sessionStorage.*audio|localStorage.*audio/);
});

test("player prefetches segments while retaining stop cleanup", () => {
  assert.match(pane, /void requestSegment\(segmentIndex \+ 1\)/);
  assert.match(pane, /ttsAbortRef\.current\?\.abort\(\)/);
  assert.match(pane, /releaseSpeechObjectUrls\(\)/);
});
