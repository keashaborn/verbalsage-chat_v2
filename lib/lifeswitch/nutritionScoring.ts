import type { PlanNutritionTargetConfig } from "./planNutritionTargets";

export type NutritionObservation = {
  day: string;
  logged: boolean;
  finalized?: boolean;
  kcal: number | null;
  proteinG: number | null;
};

type ComponentStatus = "hit" | "not_hit" | "not_evaluable";

export type DailyNutritionScore = {
  status: "hit" | "not_hit" | "no_log" | "in_progress" | "not_evaluable";
  calorieStatus: ComponentStatus;
  proteinStatus: ComponentStatus;
};

export type RollingNutritionScore = {
  status: "hit" | "not_hit" | "insufficient_data" | "not_evaluable";
  windowDays: number | null;
  loggedDays: number;
  calorieAverage: number | null;
  calorieAverageWithinRange: boolean | null;
  proteinDaysMeetingMinimum: number | null;
  proteinRequiredHitDays: number | null;
  proteinRuleMet: boolean | null;
};

function finite(value: number | null): value is number {
  return value != null && Number.isFinite(value);
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
  if (!observation.logged) {
    return {
      status: "no_log",
      calorieStatus: "not_evaluable",
      proteinStatus: "not_evaluable",
    };
  }

  if (observation.finalized === false) {
    return {
      status: "in_progress",
      calorieStatus: "not_evaluable",
      proteinStatus: "not_evaluable",
    };
  }

  const calorieStatus: ComponentStatus =
    targets.dailyRangeKcal && finite(observation.kcal)
      ? observation.kcal >= targets.dailyRangeKcal.lower &&
        observation.kcal <= targets.dailyRangeKcal.upper
        ? "hit"
        : "not_hit"
      : "not_evaluable";
  const proteinStatus: ComponentStatus =
    targets.proteinMinimumG != null && finite(observation.proteinG)
      ? observation.proteinG >= targets.proteinMinimumG
        ? "hit"
        : "not_hit"
      : "not_evaluable";

  if (targets.dailyRequiresBoth) {
    if (
      calorieStatus === "not_evaluable" ||
      proteinStatus === "not_evaluable"
    ) {
      return { status: "not_evaluable", calorieStatus, proteinStatus };
    }
    return {
      status:
        calorieStatus === "hit" && proteinStatus === "hit"
          ? "hit"
          : "not_hit",
      calorieStatus,
      proteinStatus,
    };
  }

  if (targets.nominalKcal != null && !targets.dailyRangeKcal) {
    return { status: "not_evaluable", calorieStatus, proteinStatus };
  }
  const primaryStatus = targets.dailyRangeKcal
    ? calorieStatus
    : proteinStatus;
  return {
    status:
      primaryStatus === "not_evaluable"
        ? "not_evaluable"
        : primaryStatus,
    calorieStatus,
    proteinStatus,
  };
}

export function scoreNutritionRollingWindow(
  observations: NutritionObservation[],
  asOfDay: string,
  targets: PlanNutritionTargetConfig,
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
  const logged = period
    .map((day) => byDay.get(day))
    .filter((item): item is NutritionObservation => Boolean(item));
  const calorieValues = logged
    .map((item) => item.kcal)
    .filter(finite);
  const proteinValues = logged
    .map((item) => item.proteinG)
    .filter(finite);
  const calorieAverage = calorieValues.length
    ? calorieValues.reduce((sum, value) => sum + value, 0) /
      calorieValues.length
    : null;
  const calorieComplete =
    calorieRule != null && calorieValues.length === windowDays;
  const proteinComplete =
    proteinRule != null &&
    targets.proteinMinimumG != null &&
    proteinValues.length === windowDays;
  const calorieAverageWithinRange =
    calorieComplete && calorieAverage != null
      ? calorieAverage >= calorieRule.lower &&
        calorieAverage <= calorieRule.upper
      : null;
  const proteinDaysMeetingMinimum =
    proteinRule && targets.proteinMinimumG != null
      ? proteinValues.filter((value) => value >= targets.proteinMinimumG!).length
      : null;
  const proteinRuleMet =
    proteinComplete && proteinDaysMeetingMinimum != null
      ? proteinDaysMeetingMinimum >= proteinRule.requiredHitDays
      : null;

  const requiredComponents = targets.weeklyRequiresBoth
    ? [calorieRule != null, proteinRule != null]
    : [calorieRule != null || proteinRule != null];
  if (requiredComponents.some((available) => !available)) {
    return {
      status: "not_evaluable",
      windowDays,
      loggedDays: logged.length,
      calorieAverage,
      calorieAverageWithinRange,
      proteinDaysMeetingMinimum,
      proteinRequiredHitDays: proteinRule?.requiredHitDays ?? null,
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
      loggedDays: logged.length,
      calorieAverage,
      calorieAverageWithinRange,
      proteinDaysMeetingMinimum,
      proteinRequiredHitDays: proteinRule?.requiredHitDays ?? null,
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
    loggedDays: logged.length,
    calorieAverage,
    calorieAverageWithinRange,
    proteinDaysMeetingMinimum,
    proteinRequiredHitDays: proteinRule?.requiredHitDays ?? null,
    proteinRuleMet,
  };
}
