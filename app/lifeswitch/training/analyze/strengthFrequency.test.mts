import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateStrengthFrequency,
  parseStrengthFrequencyTarget,
} from "./strengthFrequency.ts";

const today = "2026-07-22";
const targets = { workouts_per_week: "4-5 workouts/week" };

test("counts a completed strength session in the last completed seven-day window", () => {
  const result = calculateStrengthFrequency({
    today,
    trainingTargets: targets,
    sessions: [{ day: "2026-07-21", finished_at: "2026-07-21T18:00:00Z", session_role: "strength" }],
  });
  assert.equal(result.completed, 1);
  assert.equal(result.status, "below");
  assert.equal(result.windowStart, "2026-07-15");
  assert.equal(result.windowEnd, "2026-07-21");
});

test("excludes rehab-only sessions", () => {
  const result = calculateStrengthFrequency({
    today,
    trainingTargets: targets,
    sessions: [{ day: "2026-07-20", finished_at: "2026-07-20T18:00:00Z", session_role: "rehab" }],
  });
  assert.equal(result.completed, 0);
  assert.equal(result.excluded.rehab, 1);
});

test("counts a mixed strength and rehab session once", () => {
  const result = calculateStrengthFrequency({
    today,
    trainingTargets: { strength_sessions_per_week: 1 },
    sessions: [{ day: "2026-07-19", finished_at: "2026-07-19T18:00:00Z", session_role: "mixed" }],
  });
  assert.equal(result.completed, 1);
  assert.equal(result.status, "met");
});

test("excludes incomplete and unclassified sessions", () => {
  const result = calculateStrengthFrequency({
    today,
    trainingTargets: targets,
    sessions: [
      { day: "2026-07-18", finished_at: null, session_role: "strength" },
      { day: "2026-07-18", session_role: "strength" },
      { day: "2026-07-17", finished_at: "2026-07-17T18:00:00Z", session_role: "unclassified" },
      { day: "2026-07-16", finished_at: "2026-07-16T18:00:00Z" },
    ],
  });
  assert.equal(result.completed, 0);
  assert.equal(result.excluded.incomplete, 2);
  assert.equal(result.excluded.unclassified, 2);
});

test("parses a structured range and reports above target", () => {
  assert.deepEqual(parseStrengthFrequencyTarget({ sessions_per_week: { min: 2, max: 3 } }), {
    lower: 2,
    upper: 3,
    label: "2–3 sessions/week",
  });
  const result = calculateStrengthFrequency({
    today,
    trainingTargets: { sessions_per_week: { min: 2, max: 3 } },
    sessions: [15, 16, 17, 18].map((day) => ({
      day: `2026-07-${day}`,
      finished_at: `2026-07-${day}T18:00:00Z`,
      session_role: "strength",
    })),
  });
  assert.equal(result.status, "above");
});
