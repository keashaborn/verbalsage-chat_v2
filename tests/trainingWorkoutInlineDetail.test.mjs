import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "components/lifeswitch/training/WorkoutsPage.tsx",
  "utf8",
);

test("the selected workout expands beneath its own list row", () => {
  assert.match(
    source,
    /const detailId = `workout-detail-\$\{t\.workout_template_id\}`;/,
  );
  assert.match(
    source,
    /const headingId = `workout-heading-\$\{t\.workout_template_id\}`;/,
  );
  assert.match(source, /aria-expanded=\{active\}/);
  assert.match(source, /aria-controls=\{active \? detailId : undefined\}/);
  assert.match(
    source,
    /renderSelectedWorkoutDetail\(detailId, headingId\)/,
  );
  assert.doesNotMatch(source, />\s*Selected workout\s*</);
  assert.doesNotMatch(
    source,
    /\{selected \? \(\s*<section className="border-t border-border\/50 pt-6">/,
  );
});

test("the inline detail uses one semantic hierarchy without a nested main", () => {
  assert.match(
    source,
    /function renderSelectedWorkoutDetail\(detailId: string, headingId: string\)/,
  );
  assert.match(source, /id=\{detailId\}/);
  assert.match(source, /aria-labelledby=\{headingId\}/);
  assert.match(source, /<h3 id=\{headingId\} className="min-w-0">/);
  assert.doesNotMatch(source, /<main className="grid min-w-0 gap-6">/);
});

test("workout controls remain quiet and touch safe", () => {
  assert.match(
    source,
    /inline-flex min-h-11 min-w-0 items-center text-left/,
  );
  assert.match(source, /ml-auto inline-flex h-11 w-11 items-center/);
  assert.match(
    source,
    /inline-flex min-h-11 items-center rounded-lg bg-muted px-3 text-sm font-medium/,
  );
  assert.match(source, /min-h-11 w-full rounded-lg border bg-background/);
});

test("creation and workout behavior contracts remain wired", () => {
  assert.match(source, /Name the reusable template and choose its workout type/);
  assert.match(source, /onClick=\{\(\) => void createTemplate\(\)\}/);
  assert.match(source, /onClick=\{clearSelectedWorkout\}/);
  assert.match(source, /onClick=\{\(\) => void createShareLink\(\)\}/);
  assert.match(source, /void deactivateTemplate\(t\.workout_template_id\)/);
  assert.match(source, /void moveExercise\(/);
  assert.match(source, /void addExerciseToSelected\(/);
  assert.match(source, /Show exercise library/);
});
