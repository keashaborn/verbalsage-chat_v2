type JsonRecord = Record<string, unknown>;

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

export function readPlanNutritionTargets(value: unknown) {
  const targets = asRecord(value);
  const calorieTarget = asRecord(targets.calorie_target);
  const proteinTarget = asRecord(targets.protein_target);

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
  };
}
