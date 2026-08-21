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

function configured(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return Object.keys(asRecord(value)).length > 0;
}

function firstNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").replace(/,/g, " ").trim();
  if (!raw) return null;
  const match = raw.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function numericRange(value: unknown): NumericRange | null {
  const record = asRecord(value);
  if (Object.keys(record).length) {
    const first = firstNumber(record.lower ?? record.minimum ?? record.min);
    const second = firstNumber(record.upper ?? record.maximum ?? record.max);
    if (first == null || second == null) return null;
    return { lower: Math.min(first, second), upper: Math.max(first, second) };
  }

  const values = String(value ?? "")
    .replace(/,/g, "")
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter(Number.isFinite);
  if (!values || values.length < 2) return null;
  return {
    lower: Math.min(values[0], values[1]),
    upper: Math.max(values[0], values[1]),
  };
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
  const carbohydrateTarget = asRecord(
    targets.carbohydrate_target ?? targets.carbs_target,
  );
  const fatTarget = asRecord(targets.fat_target);
  const rollingCalories = asRecord(calorieTarget.rolling_average_kcal);
  const weeklyProtein = asRecord(proteinTarget.weekly_adherence);
  const adherenceRule = asRecord(targets.adherence_rule);

  const calorieRangeValue =
    calorieTarget.daily_range_kcal ??
    calorieTarget.daily_range ??
    targets.calorie_range ??
    targets.calories;
  const carbsRangeValue =
    carbohydrateTarget.daily_range_g ??
    carbohydrateTarget.daily_range ??
    targets.carbs_g;
  const fatRangeValue =
    fatTarget.daily_range_g ?? fatTarget.daily_range ?? targets.fat_g;
  const dailyRangeKcal =
    numericRange(calorieRangeValue) ?? numericRange(calorieTarget);
  const carbsRangeG =
    numericRange(carbsRangeValue) ?? numericRange(carbohydrateTarget);
  const fatRangeG = numericRange(fatRangeValue) ?? numericRange(fatTarget);
  const rollingRange = numericRange(rollingCalories);
  const rollingWindowDays = positiveInteger(rollingCalories.window_days);
  const proteinWeeklyWindowDays = positiveInteger(weeklyProtein.window_days);
  const proteinRequiredHitDays = positiveInteger(
    weeklyProtein.required_hit_days,
  );
  const proteinValue =
    proteinTarget.minimum_g ??
    targets.protein_g ??
    targets.target_protein_g ??
    targets.protein_minimum_g ??
    targets.protein_grams_minimum ??
    targets.protein;

  return {
    nominalKcal:
      firstNumber(
        calorieTarget.nominal_kcal ?? targets.target_kcal ?? targets.kcal,
      ) ??
      (numericRange(targets.calories) ? null : firstNumber(targets.calories)),
    proteinMinimumG: firstNumber(proteinValue),
    dailyRangeKcal,
    carbsRangeG,
    fatRangeG,
    calorieConfigured:
      configured(calorieRangeValue) || configured(calorieTarget),
    proteinConfigured:
      configured(proteinValue) || configured(proteinTarget),
    carbsConfigured:
      configured(carbsRangeValue) || configured(carbohydrateTarget),
    fatConfigured: configured(fatRangeValue) || configured(fatTarget),
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

export function describeConfiguredDailyTargets(
  targets: PlanNutritionTargetConfig,
): string {
  const configuredTargets = [
    targets.calorieConfigured ? "calories" : "",
    targets.proteinConfigured ? "protein" : "",
    targets.carbsConfigured ? "carbs" : "",
    targets.fatConfigured ? "fat" : "",
  ].filter(Boolean);
  return configuredTargets.length
    ? `Plan targets loaded: ${configuredTargets.join(", ")}`
    : "Plan has no nutrition targets";
}

export type PlanNutritionTargetConfig = ReturnType<
  typeof readPlanNutritionTargets
>;
