import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

const shared = read("components/lifeswitch/SegmentTabs.tsx");
const trainingCapture = read(
  "components/lifeswitch/training/TrainingCaptureModeSwitch.tsx",
);
const nutritionCapture = read(
  "components/lifeswitch/nutrition/NutritionCapturePage.tsx",
);
const trainingDesign = read("app/lifeswitch/training/design/layout.tsx");
const nutritionDesign = read("app/lifeswitch/nutrition/design/layout.tsx");

test("shared segmented controls use the thin flat presentation contract", () => {
  assert.match(shared, /rounded-lg border border-border\/60 bg-muted\/10/);
  assert.match(shared, /min-h-11/);
  assert.match(shared, /border-l border-border\/40/);
  assert.match(shared, /first:border-l-0/);
  assert.match(shared, /bg-muted\/50 text-foreground/);
  assert.doesNotMatch(shared, /rounded-xl bg-muted\/50 p-1/);
  assert.doesNotMatch(shared, /shadow-sm/);
});

test("Training Workouts and Nutrition Library use the shared selector", () => {
  assert.match(trainingDesign, /<SegmentTabs/);
  assert.match(nutritionDesign, /<SegmentTabs/);
});

test("Training Capture uses the same shared selector contract", () => {
  assert.match(
    trainingCapture,
    /segmentTabListClassName[\s\S]*segmentTabClassName/,
  );
  assert.match(trainingCapture, /grid-cols-2/);
  assert.match(trainingCapture, /aria-label="Training capture type"/);
  assert.doesNotMatch(trainingCapture, /rounded-xl/);
});

test("Nutrition Capture uses the same shared selector contract", () => {
  assert.match(
    nutritionCapture,
    /segmentTabListClassName[\s\S]*segmentTabClassName/,
  );
  assert.match(nutritionCapture, /grid-cols-2/);
  assert.match(nutritionCapture, /aria-label="Nutrition capture type"/);
  assert.match(
    nutritionCapture,
    /className=\{`mt-5 \$\{segmentTabListClassName\} grid-cols-2`\}/,
  );
  assert.doesNotMatch(
    nutritionCapture,
    /mt-5 grid grid-cols-2 overflow-hidden rounded-xl border/,
  );
});
