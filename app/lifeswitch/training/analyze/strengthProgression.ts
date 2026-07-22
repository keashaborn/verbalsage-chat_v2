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
