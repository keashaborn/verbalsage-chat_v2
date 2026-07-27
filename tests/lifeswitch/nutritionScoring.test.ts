import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { scoreNutritionDay, scoreNutritionRollingWindow } from "../../lib/lifeswitch/nutritionScoring.ts";

const targets = {
  nominalKcal: 2000,
  proteinMinimumG: 180,
  dailyRangeKcal: { lower: 1800, upper: 2100 },
  rollingAverageKcal: { lower: 1900, upper: 2000, windowDays: 7 },
  proteinWeeklyAdherence: {
    mode: "days_hit",
    windowDays: 7,
    requiredHitDays: 6,
  },
  dailyRequiresBoth: true,
  weeklyRequiresBoth: true,
} as const;

test("an unfinished current day is in progress, not a miss", () => {
  const score = scoreNutritionDay(
    {
      day: "2026-07-20",
      logged: true,
      finalized: false,
      kcal: 985,
      proteinG: 132,
    },
    targets,
  );

  assert.equal(score.status, "in_progress");
});

test("rolling scoring ignores an unfinished partial day", () => {
  const observations = Array.from({ length: 7 }, (_, index) => ({
    day: `2026-07-${String(13 + index).padStart(2, "0")}`,
    logged: true,
    finalized: true,
    kcal: 1950,
    proteinG: index === 0 ? 175 : 185,
  }));
  observations.push({
    day: "2026-07-20",
    logged: true,
    finalized: false,
    kcal: 985,
    proteinG: 132,
  });

  const score = scoreNutritionRollingWindow(
    observations,
    "2026-07-19",
    targets,
  );

  assert.equal(score.status, "hit");
  assert.equal(score.loggedDays, 7);
  assert.equal(score.calorieAverage, 1950);
  assert.equal(score.proteinDaysMeetingMinimum, 6);
});

test("a finished partial day is scored and can make the rolling window miss", () => {
  const observations = Array.from({ length: 6 }, (_, index) => ({
    day: `2026-07-${String(14 + index).padStart(2, "0")}`,
    logged: true,
    finalized: true,
    kcal: 1950,
    proteinG: 185,
  }));
  observations.push({
    day: "2026-07-20",
    logged: true,
    finalized: true,
    kcal: 985,
    proteinG: 132,
  });

  const score = scoreNutritionRollingWindow(
    observations,
    "2026-07-20",
    targets,
  );

  assert.equal(score.status, "not_hit");
  assert.equal(score.loggedDays, 7);
  assert.equal(score.proteinDaysMeetingMinimum, 6);
});

test("a medical recovery day is excused without changing the logged totals", () => {
  const score = scoreNutritionDay(
    {
      day: "2026-07-27",
      logged: true,
      finalized: true,
      adherenceExcluded: true,
      kcal: 500,
      proteinG: 30,
    },
    targets,
  );

  assert.equal(score.status, "excused");
  assert.equal(score.calorieStatus, "not_evaluable");
  assert.equal(score.proteinStatus, "not_evaluable");
});

test("rolling adherence excludes a recovery date from its denominator", () => {
  const observations = Array.from({ length: 7 }, (_, index) => ({
    day: `2026-07-${String(21 + index).padStart(2, "0")}`,
    logged: true,
    finalized: true,
    kcal: index === 6 ? 500 : 1950,
    proteinG: index === 6 ? 30 : 185,
  }));

  const score = scoreNutritionRollingWindow(
    observations,
    "2026-07-27",
    targets,
    { excludedDays: ["2026-07-27"] },
  );

  assert.equal(score.status, "hit");
  assert.equal(score.windowDays, 7);
  assert.equal(score.eligibleDays, 6);
  assert.equal(score.excludedDays, 1);
  assert.equal(score.loggedDays, 6);
  assert.equal(score.calorieAverage, 1950);
  assert.equal(score.proteinDaysMeetingMinimum, 6);
  assert.equal(score.proteinRequiredHitDays, 6);
});

test("a fully excused rolling window is paused rather than failed", () => {
  const score = scoreNutritionRollingWindow([], "2026-07-27", targets, {
    excludedDays: [
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
      "2026-07-26",
      "2026-07-27",
    ],
  });

  assert.equal(score.status, "paused");
  assert.equal(score.eligibleDays, 0);
  assert.equal(score.excludedDays, 7);
});
