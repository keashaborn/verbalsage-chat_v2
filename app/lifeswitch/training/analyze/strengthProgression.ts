export type StrengthExposureRow = {
  training_session_id: string;
  day: string;
  session_name: string;
  exercise_id: string;
  exercise_name: string;
  set_count: number;
  total_reps: number;
  max_load: number;
  total_volume: number;
  load_unit?: string | null;
};

export type StrengthExposure = {
  trainingSessionId: string;
  day: string;
  sessionName: string;
  setCount: number;
  totalReps: number;
  maxLoad: number;
  totalVolume: number;
  loadUnit: string | null;
};

export type StrengthProgressionItem = {
  exerciseId: string;
  exerciseName: string;
  exposureCount: number;
  latest: StrengthExposure;
  previous: StrengthExposure | null;
  comparisonStatus: "baseline" | "comparable" | "no_comparable_exposure";
  deltas: {
    sets: number;
    reps: number;
    maxLoad: number;
    volume: number;
  } | null;
};

export type StrengthProgressionSignal = {
  headline: string;
  detail: string;
};

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedUnit(value: unknown) {
  const unit = String(value ?? "").trim().toLowerCase();
  return unit && unit !== "mixed" ? unit : null;
}

function comparisonKey(exposure: StrengthExposure) {
  const unit = normalizedUnit(exposure.loadUnit);
  if (unit) return unit;
  return exposure.maxLoad === 0 && exposure.loadUnit !== "mixed" ? "unloaded" : null;
}

function rowComparisonKey(row: StrengthExposureRow) {
  const unit = normalizedUnit(row.load_unit);
  if (unit) return unit;
  return safeNumber(row.max_load) === 0 && row.load_unit !== "mixed"
    ? "unloaded"
    : null;
}

function signed(value: number, noun: string) {
  const numeric = safeNumber(value);
  const magnitude = Math.abs(numeric);
  const label = `${magnitude} ${noun}${magnitude === 1 ? "" : "s"}`;
  if (numeric > 0) return `${label} more`;
  if (numeric < 0) return `${label} fewer`;
  return `the same number of ${noun}s`;
}

function toExposure(row: StrengthExposureRow): StrengthExposure {
  return {
    trainingSessionId: String(row.training_session_id || ""),
    day: String(row.day || "").slice(0, 10),
    sessionName: String(row.session_name || "Training session"),
    setCount: safeNumber(row.set_count),
    totalReps: safeNumber(row.total_reps),
    maxLoad: safeNumber(row.max_load),
    totalVolume: safeNumber(row.total_volume),
    loadUnit: row.load_unit == null ? null : String(row.load_unit).trim() || null,
  };
}

export function calculateStrengthProgression(
  rows: StrengthExposureRow[],
): StrengthProgressionItem[] {
  const grouped = new Map<
    string,
    { exerciseName: string; exposures: StrengthExposure[] }
  >();

  for (const row of rows) {
    const exerciseId = String(row.exercise_id || "").trim();
    const trainingSessionId = String(row.training_session_id || "").trim();
    const day = String(row.day || "").slice(0, 10);
    if (!exerciseId || !trainingSessionId || !day) continue;

    const current = grouped.get(exerciseId) ?? {
      exerciseName: String(row.exercise_name || "Exercise"),
      exposures: [],
    };
    current.exerciseName = String(row.exercise_name || current.exerciseName || "Exercise");
    current.exposures.push(toExposure(row));
    grouped.set(exerciseId, current);
  }

  const items: StrengthProgressionItem[] = [];

  for (const [exerciseId, group] of grouped) {
    const exposures = [...group.exposures].sort((a, b) => {
      const byDay = b.day.localeCompare(a.day);
      if (byDay !== 0) return byDay;
      return b.trainingSessionId.localeCompare(a.trainingSessionId);
    });
    const latest = exposures[0];
    if (!latest) continue;

    const latestKey = comparisonKey(latest);
    const previous = latestKey
      ? exposures.slice(1).find((candidate) => comparisonKey(candidate) === latestKey) ?? null
      : null;

    items.push({
      exerciseId,
      exerciseName: group.exerciseName,
      exposureCount: exposures.length,
      latest,
      previous,
      comparisonStatus:
        exposures.length === 1
          ? "baseline"
          : previous
            ? "comparable"
            : "no_comparable_exposure",
      deltas: previous
        ? {
            sets: latest.setCount - previous.setCount,
            reps: latest.totalReps - previous.totalReps,
            maxLoad: latest.maxLoad - previous.maxLoad,
            volume: latest.totalVolume - previous.totalVolume,
          }
        : null,
    });
  }

  return items.sort((a, b) => {
    const byDay = b.latest.day.localeCompare(a.latest.day);
    if (byDay !== 0) return byDay;
    return a.exerciseName.localeCompare(b.exerciseName);
  });
}

export function comparableStrengthExposureRows(
  rows: StrengthExposureRow[],
  exerciseId: string,
): StrengthExposureRow[] {
  const matching = rows
    .filter((row) => String(row.exercise_id || "") === exerciseId)
    .sort((a, b) => {
      const byDay = String(a.day || "").localeCompare(String(b.day || ""));
      if (byDay !== 0) return byDay;
      return String(a.training_session_id || "").localeCompare(
        String(b.training_session_id || ""),
      );
    });
  const latest = matching[matching.length - 1];
  if (!latest) return [];

  const latestKey = rowComparisonKey(latest);
  if (!latestKey) return [latest];
  return matching.filter((row) => rowComparisonKey(row) === latestKey);
}

export function describeStrengthProgression(
  item: StrengthProgressionItem,
): StrengthProgressionSignal {
  if (!item.previous || !item.deltas) {
    if (item.comparisonStatus === "baseline") {
      return {
        headline: "Baseline only",
        detail: "Complete this exercise again with the same load unit to create a progression comparison.",
      };
    }
    return {
      headline: "No like-for-like comparison",
      detail: "Earlier exposures use a different, missing, or mixed load unit.",
    };
  }

  const { sets, reps, maxLoad, volume } = item.deltas;
  const unit = item.latest.loadUnit ? ` ${item.latest.loadUnit}` : "";

  if (sets === 0 && maxLoad === 0) {
    if (reps > 0) {
      return {
        headline: `${reps} more rep${reps === 1 ? "" : "s"} at the same load and set count`,
        detail: `Volume changed by ${volume > 0 ? "+" : ""}${volume}.`,
      };
    }
    if (reps < 0) {
      return {
        headline: `${Math.abs(reps)} fewer rep${Math.abs(reps) === 1 ? "" : "s"} at the same load and set count`,
        detail: `Volume changed by ${volume}.`,
      };
    }
    return {
      headline: "No change in load, sets, or total reps",
      detail: "The two latest comparable exposures produced the same recorded dose.",
    };
  }

  if (sets !== 0) {
    return {
      headline: `Training dose changed: ${signed(sets, "set")} and ${signed(reps, "rep")}`,
      detail:
        maxLoad === 0
          ? "Load was unchanged. Because set count changed, total reps and volume are not a direct like-for-like progression test."
          : `Top load changed by ${maxLoad > 0 ? "+" : ""}${maxLoad}${unit}. Because set count also changed, this is a mixed comparison.`,
    };
  }

  if (maxLoad > 0) {
    return {
      headline: `Top load increased by ${maxLoad}${unit}${reps === 0 ? " with total reps maintained" : ""}`,
      detail:
        reps === 0
          ? "Set count and total reps were unchanged."
          : `Total reps changed by ${reps > 0 ? "+" : ""}${reps} with the same set count.`,
    };
  }

  return {
    headline: `Top load decreased by ${Math.abs(maxLoad)}${unit}`,
    detail:
      reps === 0
        ? "Set count and total reps were unchanged."
        : `Total reps changed by ${reps > 0 ? "+" : ""}${reps} with the same set count.`,
  };
}
