type SourceState =
  | "ready"
  | "missing"
  | "permission_denied"
  | "unavailable"
  | "invalid_response";

type ProjectionInput = Readonly<{
  delegatedView: boolean;
  today: string;
  sessions: readonly unknown[] | null;
  conditioningSessions: readonly unknown[] | null;
  sessionsState: SourceState;
  conditioningState: SourceState;
  plan: unknown;
  planState: SourceState;
  recoveryAdjustments: readonly unknown[] | null;
  recoveryState: SourceState;
}>;

export type TrainingCalendarSageContext = Readonly<{
  context_version: "training_calendar_context_v1";
  delegated_view: boolean;
  active_state_ids: readonly string[];
  record_boundary: Readonly<{
    resistance_limit: 250;
    conditioning_limit: 250;
    resistance_returned: number;
    conditioning_returned: number;
    resistance_may_be_truncated: boolean;
    conditioning_may_be_truncated: boolean;
  }>;
  source_status: Readonly<{
    resistance: SourceState;
    conditioning: SourceState;
    plan: SourceState;
    recovery_adjustments: SourceState;
  }>;
  plan_context: unknown;
  recovery_context: Readonly<{
    today: string;
    active_strength_period: unknown;
  }>;
  totals: Readonly<Record<string, number>>;
  monthly_summaries: readonly Readonly<Record<string, number | string>>[];
  recent_resistance: readonly Readonly<Record<string, unknown>>[];
  recent_conditioning: readonly Readonly<Record<string, unknown>>[];
}>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, maximum = 240): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sessionRole(
  row: Record<string, unknown>,
): "strength" | "rehab" | "mixed" | "unclassified" {
  const supplied = text(row.session_role, 32);
  if (
    supplied === "strength" ||
    supplied === "rehab" ||
    supplied === "mixed" ||
    supplied === "unclassified"
  ) {
    return supplied;
  }
  const strengthSets = number(row.strength_set_count);
  const rehabSets = number(row.rehab_set_count);
  if (strengthSets > 0 && rehabSets > 0) return "mixed";
  if (rehabSets > 0) return "rehab";
  if (strengthSets > 0) return "strength";
  return "unclassified";
}

function countsTowardStrength(row: Record<string, unknown>): boolean {
  if (typeof row.counts_toward_strength === "boolean") {
    return row.counts_toward_strength;
  }
  const role = sessionRole(row);
  return role === "strength" || role === "mixed";
}

function strengthMetric(
  row: Record<string, unknown>,
  preferred: string,
  fallback: string,
): number {
  if (row[preferred] !== undefined && row[preferred] !== null) {
    return number(row[preferred]);
  }
  return countsTowardStrength(row) ? number(row[fallback]) : 0;
}

function boundedValue(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.slice(0, 1_000);
  if (depth >= 4) return null;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => boundedValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    ).slice(0, 40)) {
      output[key.slice(0, 120)] = boundedValue(item, depth + 1);
    }
    return output;
  }
  return null;
}

function planProjection(value: unknown): unknown {
  const source = record(value);
  if (Object.keys(source).length === 0) return null;
  return boundedValue({
    primary_goal: source.primary_goal ?? null,
    phase: source.phase ?? null,
    phase_label: source.phase_label ?? null,
    training_targets: source.training_targets ?? null,
    conditioning_targets: source.conditioning_targets ?? null,
    recovery_targets: source.recovery_targets ?? null,
    monitoring_rules: source.monitoring_rules ?? null,
  });
}

function activeStrengthPeriod(
  adjustments: readonly unknown[],
  today: string,
): unknown {
  for (const value of adjustments) {
    const source = record(value);
    const period = record(source.strength_period);
    const startsOn = text(period.starts_on, 10);
    const endsOn = text(period.ends_on, 10);
    if (startsOn && endsOn && startsOn <= today && today <= endsOn) {
      return {
        reason_code: text(source.reason_code, 120),
        starts_on: startsOn,
        ends_on: endsOn,
      };
    }
  }
  return null;
}

export function projectTrainingCalendarSageContext(
  input: ProjectionInput,
): TrainingCalendarSageContext {
  const trainingReady =
    input.sessionsState === "ready" &&
    input.conditioningState === "ready" &&
    Array.isArray(input.sessions) &&
    Array.isArray(input.conditioningSessions);
  const sessions = trainingReady ? input.sessions : [];
  const conditioning = trainingReady ? input.conditioningSessions : [];
  const recoveryPeriod =
    input.recoveryState === "ready" && Array.isArray(input.recoveryAdjustments)
      ? activeStrengthPeriod(input.recoveryAdjustments, input.today)
      : null;

  const activeStates: string[] = [
    !trainingReady
      ? "load_error"
      : sessions.length === 0 && conditioning.length === 0
        ? "empty"
        : "ready",
  ];
  if (input.delegatedView) activeStates.push("delegated_read_only");
  if (recoveryPeriod) activeStates.push("recovery_adjustment_active");

  const months = new Map<
    string,
    {
      resistance_sessions: number;
      strength_workouts: number;
      rehab_only_sessions: number;
      unclassified_sessions: number;
      conditioning_sessions: number;
      strength_sets: number;
      strength_volume: number;
      conditioning_minutes: number;
    }
  >();
  const month = (ym: string) => {
    const current = months.get(ym) || {
      resistance_sessions: 0,
      strength_workouts: 0,
      rehab_only_sessions: 0,
      unclassified_sessions: 0,
      conditioning_sessions: 0,
      strength_sets: 0,
      strength_volume: 0,
      conditioning_minutes: 0,
    };
    months.set(ym, current);
    return current;
  };

  for (const value of sessions) {
    const row = record(value);
    const ym = text(row.day, 10).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    const summary = month(ym);
    const role = sessionRole(row);
    summary.resistance_sessions += 1;
    if (countsTowardStrength(row)) summary.strength_workouts += 1;
    if (role === "rehab") summary.rehab_only_sessions += 1;
    if (role === "unclassified") summary.unclassified_sessions += 1;
    summary.strength_sets += strengthMetric(
      row,
      "strength_set_count",
      "set_count",
    );
    summary.strength_volume += strengthMetric(row, "strength_volume", "volume");
  }
  for (const value of conditioning) {
    const row = record(value);
    const ym = text(row.day, 10).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    const summary = month(ym);
    summary.conditioning_sessions += 1;
    summary.conditioning_minutes += number(row.duration_min);
  }

  const recentResistance = sessions
    .map(record)
    .sort((a, b) =>
      `${text(b.day, 10)}:${text(b.created_at, 40)}`.localeCompare(
        `${text(a.day, 10)}:${text(a.created_at, 40)}`,
      ),
    )
    .slice(0, 12)
    .map((row) => {
      const role = sessionRole(row);
      return {
        day: text(row.day, 10),
        name: text(row.name),
        role,
        calendar_strength_marker: countsTowardStrength(row),
        set_count: number(row.set_count),
        exercise_count: number(row.exercise_count),
        strength_set_count: strengthMetric(
          row,
          "strength_set_count",
          "set_count",
        ),
        strength_volume: strengthMetric(row, "strength_volume", "volume"),
        rehab_set_count: number(row.rehab_set_count),
      };
    });
  const recentConditioning = conditioning
    .map(record)
    .sort((a, b) =>
      `${text(b.day, 10)}:${text(b.created_at, 40)}`.localeCompare(
        `${text(a.day, 10)}:${text(a.created_at, 40)}`,
      ),
    )
    .slice(0, 12)
    .map((row) => ({
      day: text(row.day, 10),
      name: text(row.name),
      category: text(row.category, 120),
      modality: text(row.modality, 120),
      duration_min: number(row.duration_min),
      intensity: text(row.intensity),
    }));

  const allMonthlySummaries = [...months.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([year_month, summary]) => ({ year_month, ...summary }));
  const monthlySummaries = allMonthlySummaries.slice(0, 12);

  return {
    context_version: "training_calendar_context_v1",
    delegated_view: input.delegatedView,
    active_state_ids: activeStates,
    record_boundary: {
      resistance_limit: 250,
      conditioning_limit: 250,
      resistance_returned: sessions.length,
      conditioning_returned: conditioning.length,
      resistance_may_be_truncated: sessions.length === 250,
      conditioning_may_be_truncated: conditioning.length === 250,
    },
    source_status: {
      resistance: input.sessionsState,
      conditioning: input.conditioningState,
      plan: input.planState,
      recovery_adjustments: input.recoveryState,
    },
    plan_context:
      input.planState === "ready" ? planProjection(input.plan) : null,
    recovery_context: {
      today: input.today,
      active_strength_period: recoveryPeriod,
    },
    totals: allMonthlySummaries.reduce(
      (totals, summary) => {
        totals.resistance_sessions += number(summary.resistance_sessions);
        totals.strength_workouts += number(summary.strength_workouts);
        totals.conditioning_sessions += number(summary.conditioning_sessions);
        totals.strength_sets += number(summary.strength_sets);
        totals.strength_volume += number(summary.strength_volume);
        totals.conditioning_minutes += number(summary.conditioning_minutes);
        return totals;
      },
      {
        resistance_sessions: 0,
        strength_workouts: 0,
        conditioning_sessions: 0,
        strength_sets: 0,
        strength_volume: 0,
        conditioning_minutes: 0,
      },
    ),
    monthly_summaries: monthlySummaries,
    recent_resistance: recentResistance,
    recent_conditioning: recentConditioning,
  };
}
