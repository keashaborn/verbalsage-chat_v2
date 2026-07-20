type JsonRecord = Record<string, unknown>;

export type NumericRange = {
  lower: number;
  upper: number;
};

export type RollingCalorieRule = NumericRange & {
  windowDays: number;
};

export type ProteinWeeklyRule = {
  mode: "days_hit";
  windowDays: number;
  requiredHitDays: number;
};

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function firstNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "")
    .replace(/,/g, " ")
    .trim();
  if (!raw) return null;
  const match = raw.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function numericRange(value: unknown): NumericRange | null {
  const record = asRecord(value);
  const first = firstNumber(record.lower ?? record.minimum ?? record.min);
  const second = firstNumber(record.upper ?? record.maximum ?? record.max);
  if (first == null || second == null) return null;
  return { lower: Math.min(first, second), upper: Math.max(first, second) };
}

function positiveInteger(value: unknown): number | null {
  const parsed = firstNumber(value);
  return parsed != null && Number.isInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

export function readPlanNutritionTargets(value: unknown) {
  const targets = asRecord(value);
  const calorieTarget = asRecord(targets.calorie_target);
  const proteinTarget = asRecord(targets.protein_target);
  const rollingCalories = asRecord(calorieTarget.rolling_average_kcal);
  const weeklyProtein = asRecord(proteinTarget.weekly_adherence);
  const adherenceRule = asRecord(targets.adherence_rule);
  const dailyRangeKcal = numericRange(calorieTarget.daily_range_kcal);
  const rollingRange = numericRange(rollingCalories);
  const rollingWindowDays = positiveInteger(rollingCalories.window_days);
  const proteinWeeklyWindowDays = positiveInteger(weeklyProtein.window_days);
  const proteinRequiredHitDays = positiveInteger(
    weeklyProtein.required_hit_days,
  );

  return {
    nominalKcal: firstNumber(
      calorieTarget.nominal_kcal ??
        targets.calories ??
        targets.target_kcal ??
        targets.kcal,
    ),
    proteinMinimumG: firstNumber(
      proteinTarget.minimum_g ??
        targets.protein_g ??
        targets.target_protein_g ??
        targets.protein_minimum_g ??
        targets.protein_grams_minimum ??
        targets.protein,
    ),
    dailyRangeKcal,
    rollingAverageKcal:
      rollingRange && rollingWindowDays
        ? { ...rollingRange, windowDays: rollingWindowDays }
        : null,
    proteinWeeklyAdherence:
      weeklyProtein.mode === "days_hit" &&
      proteinWeeklyWindowDays &&
      proteinRequiredHitDays &&
      proteinRequiredHitDays <= proteinWeeklyWindowDays
        ? {
            mode: "days_hit" as const,
            windowDays: proteinWeeklyWindowDays,
            requiredHitDays: proteinRequiredHitDays,
          }
        : null,
    dailyRequiresBoth:
      adherenceRule.daily_requires_both_calorie_and_protein === true,
    weeklyRequiresBoth:
      adherenceRule.weekly_requires_both_calorie_and_protein === true,
  };
}

export type PlanNutritionTargetConfig = ReturnType<
  typeof readPlanNutritionTargets
>;
