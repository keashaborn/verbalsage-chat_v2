const assert = require("node:assert/strict");
const test = require("node:test");

const {
  scoreNutritionDay,
  scoreNutritionRollingWindow,
} = require("../../lib/lifeswitch/nutritionScoring.ts");

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
