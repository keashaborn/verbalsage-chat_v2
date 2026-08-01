import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const strength = readFileSync(
  "app/lifeswitch/training/capture/page.tsx",
  "utf8",
);
const conditioning = readFileSync(
  "app/lifeswitch/training/capture/conditioning/page.tsx",
  "utf8",
);
const modeSwitch = readFileSync(
  "components/lifeswitch/training/TrainingCaptureModeSwitch.tsx",
  "utf8",
);

test("both capture pages use one quiet, touch-safe mode selector", () => {
  assert.match(strength, /<TrainingCaptureModeSwitch selected="strength" \/>/);
  assert.match(
    conditioning,
    /<TrainingCaptureModeSwitch selected="conditioning" \/>/,
  );
  assert.match(modeSwitch, /aria-label="Training capture type"/);
  assert.match(modeSwitch, /min-h-11/);
  assert.match(modeSwitch, /rounded-lg border border-border\/60 bg-muted\/10/);
  assert.match(modeSwitch, /aria-current="page"/);
  assert.match(modeSwitch, /href: "\/lifeswitch\/training\/capture"/);
  assert.match(
    modeSwitch,
    /href: "\/lifeswitch\/training\/capture\/conditioning"/,
  );
});

test("draft headers lead with the selected workout and keep status quiet", () => {
  for (const source of [strength, conditioning]) {
    assert.match(
      source,
      /<h2 className="min-w-0 truncate text-base font-semibold">/,
    );
    assert.match(source, />\s*Active draft\s*<\/div>/);
    assert.match(
      source,
      /sm:grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/,
    );
  }
  assert.match(strength, /\{selected\?\.name \|\| "Workout draft"\}/);
  assert.match(conditioning, /\{selected\?\.name \|\| "Conditioning draft"\}/);
});

test("draft actions are compact without adding a save control", () => {
  for (const source of [strength, conditioning]) {
    assert.match(
      source,
      /rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted\/30/,
    );
    assert.match(
      source,
      /rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground/,
    );
    assert.doesNotMatch(source, />\s*Save(?: draft)?\s*</i);
  }
  assert.match(strength, /setFlash\("Draft discarded\."\)/);
  assert.match(conditioning, /setStatus\("Draft discarded\."\)/);
});

test("exercise menu is one flat touch-safe list", () => {
  assert.match(
    strength,
    /w-52 rounded-lg border border-border\/60 bg-popover p-1 shadow-lg/,
  );
  assert.match(strength, />\s*Add set\s*<\/button>/);
  assert.match(strength, />\s*Add Exercise\s*<\/button>/);
  assert.match(strength, />\s*Remove Exercise\s*<\/button>/);
  assert.match(strength, /min-h-11 w-full rounded-md px-3 text-left text-sm/);
  assert.match(strength, /border-t border-border\/60/);
});

test("capture data entry and completion interactions remain in place", () => {
  assert.match(
    strength,
    /\{previousDay \? formatWorkoutDay\(previousDay\) : "Last"\}/,
  );
  assert.match(strength, /formatPreviousSet\(/);
  assert.match(strength, /mode="decimal"/);
  assert.match(strength, /mode="integer"/);
  assert.match(strength, /done: !row\.done/);
  assert.match(strength, /aria-pressed=\{row\.done\}/);
  assert.match(strength, /text-blue-600 dark:text-blue-400/);
  assert.match(strength, /TRAINING_CAPTURE_DRAFT_KEY/);
  assert.match(conditioning, /CONDITIONING_CAPTURE_DRAFT_KEY/);
});

test("existing finish and discard handlers remain wired", () => {
  assert.match(strength, /onClick=\{discardLocalDraft\}/);
  assert.match(strength, /onClick=\{\(\) => void finishSession\(\)\}/);
  assert.match(conditioning, /onClick=\{discardConditioningDraft\}/);
  assert.match(conditioning, /onClick=\{\(\) => void saveSession\(\)\}/);
  assert.match(strength, /method: "POST"/);
  assert.match(conditioning, /method: "POST"/);
});
