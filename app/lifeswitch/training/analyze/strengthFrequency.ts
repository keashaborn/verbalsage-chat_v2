export type StrengthFrequencySession = {
  day?: string | null;
  finished_at?: string | null;
  is_active?: boolean;
  session_role?: string | null;
  counts_toward_strength?: boolean | null;
  strength_set_count?: number | null;
  rehab_set_count?: number | null;
  set_count?: number | null;
};

export type StrengthFrequencyTarget = {
  lower: number;
  upper: number;
  label: string;
};

export type StrengthFrequencyStatus =
  | "met"
  | "below"
  | "above"
  | "insufficient_data";

export type StrengthFrequencyResult = {
  target: StrengthFrequencyTarget | null;
  completed: number;
  status: StrengthFrequencyStatus;
  windowStart: string;
  windowEnd: string;
  excluded: {
    rehab: number;
    unclassified: number;
    incomplete: number;
  };
};

const TARGET_KEYS = [
  "strength_sessions_per_week",
  "workouts_per_week",
  "sessions_per_week",
] as const;

function boundedNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 14 ? parsed : null;
}

function targetFromValue(value: unknown): StrengthFrequencyTarget | null {
  if (typeof value === "number") {
    const point = boundedNumber(value);
    return point === null
      ? null
      : { lower: point, upper: point, label: `${point} sessions/week` };
  }

  if (typeof value === "string") {
    const range = value.match(/(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)/);
    if (range) {
      const lower = boundedNumber(range[1]);
      const upper = boundedNumber(range[2]);
      if (lower !== null && upper !== null && lower <= upper) {
        return { lower, upper, label: `${lower}–${upper} sessions/week` };
      }
    }
    const point = value.match(/\d+(?:\.\d+)?/);
    if (point) return targetFromValue(Number(point[0]));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const lower = boundedNumber(record.lower ?? record.min ?? record.minimum);
    const upper = boundedNumber(record.upper ?? record.max ?? record.maximum);
    if (lower !== null && upper !== null && lower <= upper) {
      return { lower, upper, label: `${lower}–${upper} sessions/week` };
    }
    const point = boundedNumber(record.target ?? record.value);
    if (point !== null) return targetFromValue(point);
  }

  return null;
}

export function parseStrengthFrequencyTarget(
  trainingTargets: Record<string, unknown> | null | undefined,
): StrengthFrequencyTarget | null {
  if (!trainingTargets) return null;

  for (const key of TARGET_KEYS) {
    const parsed = targetFromValue(trainingTargets[key]);
    if (parsed) return parsed;
  }

  for (const key of ["linked_workout_schedule", "workout_schedule", "linked_workouts"]) {
    const rows = trainingTargets[key];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    let total = 0;
    let found = false;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const sessions = boundedNumber((row as Record<string, unknown>).sessions_per_week);
      if (sessions !== null) {
        total += sessions;
        found = true;
      }
    }
    if (found && total <= 14) return targetFromValue(total);
  }

  return null;
}

function shiftDay(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function calculateStrengthFrequency(args: {
  sessions: StrengthFrequencySession[];
  trainingTargets?: Record<string, unknown> | null;
  today?: string;
}): StrengthFrequencyResult {
  const windowEnd = shiftDay(args.today ?? todayUtc(), -1);
  const windowStart = shiftDay(windowEnd, -6);
  const target = parseStrengthFrequencyTarget(args.trainingTargets);
  let completed = 0;
  const excluded = { rehab: 0, unclassified: 0, incomplete: 0 };

  for (const session of args.sessions) {
    if (session.is_active === false) continue;
    if (!session.day || session.day < windowStart || session.day > windowEnd) continue;
    if (!session.finished_at) {
      excluded.incomplete += 1;
      continue;
    }

    const role = String(session.session_role ?? "").trim().toLowerCase();
    if (role === "strength" || role === "mixed" || role === "both") {
      completed += 1;
      continue;
    }
    if (role === "rehab" || role === "prehab") {
      excluded.rehab += 1;
      continue;
    }
    if (role === "unclassified") {
      excluded.unclassified += 1;
      continue;
    }

    if (Number(session.strength_set_count ?? 0) > 0) {
      completed += 1;
    } else if (
      session.counts_toward_strength === true &&
      Number(session.set_count ?? 0) > 0
    ) {
      completed += 1;
    } else if (Number(session.rehab_set_count ?? 0) > 0) {
      excluded.rehab += 1;
    } else {
      excluded.unclassified += 1;
    }
  }

  let status: StrengthFrequencyStatus = "insufficient_data";
  if (target) {
    if (completed < target.lower) status = "below";
    else if (completed > target.upper) status = "above";
    else status = "met";
  }

  return { target, completed, status, windowStart, windowEnd, excluded };
}
