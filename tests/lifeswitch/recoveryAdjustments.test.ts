import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { dayIsInRecoveryPeriod, recoveryDaysForDomain, type RecoveryAdjustment } from "../../lib/lifeswitch/recoveryAdjustments.ts";

test("recovery periods are inclusive", () => {
  const period = { starts_on: "2026-07-27", ends_on: "2026-08-09" };
  assert.equal(dayIsInRecoveryPeriod("2026-07-27", period), true);
  assert.equal(dayIsInRecoveryPeriod("2026-08-09", period), true);
  assert.equal(dayIsInRecoveryPeriod("2026-08-10", period), false);
});

test("domain recovery days do not leak across nutrition and strength", () => {
  const adjustments: RecoveryAdjustment[] = [
    {
      adjustment_id: "019848f8-f580-7000-8000-000000000001",
      reason_code: "surgery_recovery",
      note: "",
      nutrition_period: {
        starts_on: "2026-07-27",
        ends_on: "2026-07-27",
      },
      strength_period: {
        starts_on: "2026-07-27",
        ends_on: "2026-07-29",
      },
      configured_nutrition_period: {
        starts_on: "2026-07-27",
        ends_on: "2026-07-27",
      },
      configured_strength_period: {
        starts_on: "2026-07-27",
        ends_on: "2026-07-29",
      },
      created_at: "2026-07-27T12:00:00Z",
      stopped_on: null,
      stopped_at: null,
    },
  ];
  assert.deepEqual(
    [...recoveryDaysForDomain(adjustments, "nutrition")],
    ["2026-07-27"],
  );
  assert.deepEqual(
    [...recoveryDaysForDomain(adjustments, "strength")],
    ["2026-07-27", "2026-07-28", "2026-07-29"],
  );
});
