import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateStrengthProgression,
  type StrengthExposureRow,
} from "./strengthProgression.ts";

function exposure(
  overrides: Partial<StrengthExposureRow> = {},
): StrengthExposureRow {
  return {
    training_session_id: "session-1",
    day: "2026-07-22",
    session_name: "Push",
    exercise_id: "exercise-1",
    exercise_name: "Chest Press",
    set_count: 3,
    total_reps: 50,
    max_load: 148,
    total_volume: 7400,
    load_unit: "lb",
    ...overrides,
  };
}

test("compares the latest exposure with the previous same-unit exposure", () => {
  const [item] = calculateStrengthProgression([
    exposure(),
    exposure({
      training_session_id: "session-0",
      day: "2026-07-15",
      total_reps: 47,
      max_load: 143,
      total_volume: 6900,
    }),
  ]);

  assert.equal(item.comparisonStatus, "comparable");
  assert.equal(item.previous?.day, "2026-07-15");
  assert.deepEqual(item.deltas, { sets: 0, reps: 3, maxLoad: 5, volume: 500 });
});

test("reports a single exposure as a baseline", () => {
  const [item] = calculateStrengthProgression([exposure()]);
  assert.equal(item.exposureCount, 1);
  assert.equal(item.comparisonStatus, "baseline");
  assert.equal(item.previous, null);
  assert.equal(item.deltas, null);
});

test("skips an intervening exposure with a different load unit", () => {
  const [item] = calculateStrengthProgression([
    exposure(),
    exposure({ training_session_id: "session-kg", day: "2026-07-18", load_unit: "kg" }),
    exposure({ training_session_id: "session-lb", day: "2026-07-10", max_load: 140 }),
  ]);
  assert.equal(item.previous?.trainingSessionId, "session-lb");
  assert.equal(item.deltas?.maxLoad, 8);
});

test("does not compare exposures when no matching load unit exists", () => {
  const [item] = calculateStrengthProgression([
    exposure(),
    exposure({ training_session_id: "session-kg", day: "2026-07-18", load_unit: "kg" }),
  ]);
  assert.equal(item.comparisonStatus, "no_comparable_exposure");
  assert.equal(item.previous, null);
});

test("keeps exercises separate and orders them by latest exposure", () => {
  const items = calculateStrengthProgression([
    exposure({ day: "2026-07-20" }),
    exposure({
      training_session_id: "session-2",
      day: "2026-07-21",
      exercise_id: "exercise-2",
      exercise_name: "Row",
    }),
  ]);
  assert.deepEqual(items.map((item) => item.exerciseName), ["Row", "Chest Press"]);
});
