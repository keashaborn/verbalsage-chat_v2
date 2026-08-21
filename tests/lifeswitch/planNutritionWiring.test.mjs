import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


const logPage = readFileSync(
  "app/lifeswitch/nutrition/log/page.tsx",
  "utf8",
);
const analyzePage = readFileSync(
  "app/lifeswitch/nutrition/analyze/page.tsx",
  "utf8",
);
const planEditor = readFileSync(
  "components/lifeswitch/plan/PlanProfileClient.tsx",
  "utf8",
);


test("Nutrition Log and Analyze load the canonical Plan profile", () => {
  for (const source of [logPage, analyzePage]) {
    assert.match(
      source,
      /\/api\/lifeswitch\/plan\/profile\?create_if_missing=0/,
    );
    assert.match(source, /planProfile\?\.nutrition_targets/);
    assert.match(source, /carbsG: day\.carbs_g/);
    assert.match(source, /fatG: day\.fat_g/);
  }
  assert.match(analyzePage, /const carbsHitDays/);
  assert.match(analyzePage, /const fatHitDays/);
  assert.match(analyzePage, /value={nutritionTargets\.carbsRangeG/);
  assert.match(analyzePage, /value={nutritionTargets\.fatRangeG/);
});

test("Plan editor persists separate carbs and fat targets without dropping unknown fields", () => {
  assert.match(planEditor, /\.\.\.asObject\(plan\?\.nutrition_targets\)/);
  assert.match(planEditor, /carbs_g: nutritionDraft\.carbs_g/);
  assert.match(planEditor, /fat_g: nutritionDraft\.fat_g/);
  assert.match(planEditor, /label="Carbs"/);
  assert.match(planEditor, /label="Fat"/);
});
