import type { PlanNutritionTargetConfig } from "./planNutritionTargets";

export type NutritionObservation = {
  day: string;
  logged: boolean;
  finalized?: boolean;
  adherenceExcluded?: boolean;
  kcal: number | null;
  proteinG: number | null;
  carbsG?: number | null;
  fatG?: number | null;
};

type ComponentStatus = "hit" | "not_hit" | "not_evaluable";

export type DailyNutritionScore = {
  status:
    | "hit"
    | "not_hit"
    | "no_log"
    | "in_progress"
    | "not_evaluable"
    | "excused";
  calorieStatus: ComponentStatus;
  proteinStatus: ComponentStatus;
  carbsStatus: ComponentStatus;
  fatStatus: ComponentStatus;
};

export type RollingNutritionScore = {
  status:
    | "hit"
    | "not_hit"
    | "insufficient_data"
    | "not_evaluable"
    | "paused";
  windowDays: number | null;
  eligibleDays: number;
  excludedDays: number;
  loggedDays: number;
  calorieAverage: number | null;
  calorieAverageWithinRange: boolean | null;
  proteinDaysMeetingMinimum: number | null;
  proteinRequiredHitDays: number | null;
  proteinRuleMet: boolean | null;
};

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

function rangeStatus(
  configured: boolean,
  value: number | null | undefined,
  range: { lower: number; upper: number } | null,
): ComponentStatus {
  if (!configured || !finite(value) || !range) return "not_evaluable";
  return value >= range.lower && value <= range.upper ? "hit" : "not_hit";
}

function emptyDailyStatus(
  status: DailyNutritionScore["status"],
): DailyNutritionScore {
  return {
    status,
    calorieStatus: "not_evaluable",
    proteinStatus: "not_evaluable",
    carbsStatus: "not_evaluable",
    fatStatus: "not_evaluable",
  };
}

function dayAtOffset(day: string, offset: number): string {
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setUTCDate(parsed.getUTCDate() + offset);
  return parsed.toISOString().slice(0, 10);
}

export function scoreNutritionDay(
  observation: NutritionObservation,
  targets: PlanNutritionTargetConfig,
): DailyNutritionScore {
  if (observation.adherenceExcluded) return emptyDailyStatus("excused");
  if (!observation.logged) return emptyDailyStatus("no_log");
  if (observation.finalized === false) return emptyDailyStatus("in_progress");

  const calorieStatus = rangeStatus(
    targets.calorieConfigured,
    observation.kcal,
    targets.dailyRangeKcal,
  );
  const proteinStatus: ComponentStatus =
    targets.proteinConfigured &&
    targets.proteinMinimumG != null &&
    finite(observation.proteinG)
      ? observation.proteinG >= targets.proteinMinimumG
        ? "hit"
        : "not_hit"
      : "not_evaluable";
  const carbsStatus = rangeStatus(
    targets.carbsConfigured,
    observation.carbsG,
    targets.carbsRangeG,
  );
  const fatStatus = rangeStatus(
    targets.fatConfigured,
    observation.fatG,
    targets.fatRangeG,
  );
  const components = [
    targets.calorieConfigured ? calorieStatus : null,
    targets.proteinConfigured ? proteinStatus : null,
    targets.carbsConfigured ? carbsStatus : null,
    targets.fatConfigured ? fatStatus : null,
  ].filter((status): status is ComponentStatus => status != null);

  const status: DailyNutritionScore["status"] =
    components.includes("not_hit")
      ? "not_hit"
      : components.length === 0 || components.includes("not_evaluable")
        ? "not_evaluable"
        : "hit";
  return { status, calorieStatus, proteinStatus, carbsStatus, fatStatus };
}

export function scoreNutritionRollingWindow(
  observations: NutritionObservation[],
  asOfDay: string,
  targets: PlanNutritionTargetConfig,
  options: { excludedDays?: Iterable<string> } = {},
): RollingNutritionScore {
  const calorieRule = targets.rollingAverageKcal;
  const proteinRule = targets.proteinWeeklyAdherence;
  const configuredWindows = [
    calorieRule?.windowDays,
    proteinRule?.windowDays,
  ].filter((value): value is number => value != null);
  const windowDays = configuredWindows[0] ?? null;

  if (
    windowDays == null ||
    configuredWindows.some((value) => value !== windowDays)
  ) {
    return {
      status: "not_evaluable",
      windowDays,
      eligibleDays: 0,
      excludedDays: 0,
      loggedDays: 0,
      calorieAverage: null,
      calorieAverageWithinRange: null,
      proteinDaysMeetingMinimum: null,
      proteinRequiredHitDays: proteinRule?.requiredHitDays ?? null,
      proteinRuleMet: null,
    };
  }

  const byDay = new Map(
    observations
      .filter((item) => item.logged && item.finalized !== false)
      .map((item) => [item.day, item]),
  );
  const period = Array.from({ length: windowDays }, (_, index) =>
    dayAtOffset(asOfDay, index - windowDays + 1),
  );
  const excludedDaySet = new Set(options.excludedDays || []);
  const eligiblePeriod = period.filter((day) => !excludedDaySet.has(day));
  const excludedDays = period.length - eligiblePeriod.length;
  const eligibleDays = eligiblePeriod.length;
  const logged = eligiblePeriod
    .map((day) => byDay.get(day))
    .filter((item): item is NutritionObservation => Boolean(item));
  const calorieValues = logged.map((item) => item.kcal).filter(finite);
  const proteinValues = logged.map((item) => item.proteinG).filter(finite);
  const calorieAverage = calorieValues.length
    ? calorieValues.reduce((sum, value) => sum + value, 0) /
      calorieValues.length
    : null;
  const calorieComplete =
    calorieRule != null && calorieValues.length === eligibleDays;
  const proteinComplete =
    proteinRule != null &&
    targets.proteinMinimumG != null &&
    proteinValues.length === eligibleDays;
  const calorieAverageWithinRange =
    calorieComplete && calorieAverage != null
      ? calorieAverage >= calorieRule.lower &&
        calorieAverage <= calorieRule.upper
      : null;
  const proteinDaysMeetingMinimum =
    proteinRule && targets.proteinMinimumG != null
      ? proteinValues.filter((value) => value >= targets.proteinMinimumG!).length
      : null;
  const proteinRequiredHitDays =
    proteinRule == null
      ? null
      : Math.min(
          eligibleDays,
          Math.ceil(
            (proteinRule.requiredHitDays / proteinRule.windowDays) * eligibleDays,
          ),
        );
  const proteinRuleMet =
    proteinComplete && proteinDaysMeetingMinimum != null
      ? proteinDaysMeetingMinimum >= (proteinRequiredHitDays ?? 0)
      : null;

  if (eligibleDays === 0 && excludedDays > 0) {
    return {
      status: "paused",
      windowDays,
      eligibleDays,
      excludedDays,
      loggedDays: 0,
      calorieAverage: null,
      calorieAverageWithinRange: null,
      proteinDaysMeetingMinimum: null,
      proteinRequiredHitDays,
      proteinRuleMet: null,
    };
  }

  const requiredComponents = targets.weeklyRequiresBoth
    ? [calorieRule != null, proteinRule != null]
    : [calorieRule != null || proteinRule != null];
  if (requiredComponents.some((available) => !available)) {
    return {
      status: "not_evaluable",
      windowDays,
      eligibleDays,
      excludedDays,
      loggedDays: logged.length,
      calorieAverage,
      calorieAverageWithinRange,
      proteinDaysMeetingMinimum,
      proteinRequiredHitDays,
      proteinRuleMet,
    };
  }

  const complete = targets.weeklyRequiresBoth
    ? calorieComplete && proteinComplete
    : calorieRule
      ? calorieComplete
      : proteinComplete;
  if (!complete) {
    return {
      status: "insufficient_data",
      windowDays,
      eligibleDays,
      excludedDays,
      loggedDays: logged.length,
      calorieAverage,
      calorieAverageWithinRange,
      proteinDaysMeetingMinimum,
      proteinRequiredHitDays,
      proteinRuleMet,
    };
  }

  const hit = targets.weeklyRequiresBoth
    ? calorieAverageWithinRange === true && proteinRuleMet === true
    : calorieRule
      ? calorieAverageWithinRange === true
      : proteinRuleMet === true;
  return {
    status: hit ? "hit" : "not_hit",
    windowDays,
    eligibleDays,
    excludedDays,
    loggedDays: logged.length,
    calorieAverage,
    calorieAverageWithinRange,
    proteinDaysMeetingMinimum,
    proteinRequiredHitDays,
    proteinRuleMet,
  };
}
