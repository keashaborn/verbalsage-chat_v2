export type NutritionSourceState =
  | "ready"
  | "missing"
  | "permission_denied"
  | "unavailable"
  | "invalid_response";

type ProjectionInput = Readonly<{
  delegatedView: boolean;
  today: string;
  startDay: string;
  endDay: string;
  range: unknown;
  rangeState: NutritionSourceState;
  plan: unknown;
  planState: NutritionSourceState;
  recoveryAdjustments: readonly unknown[] | null;
  recoveryState: NutritionSourceState;
}>;

type NumericRange = Readonly<{
  lower: number;
  upper: number;
}>;

type ComponentStatus = "hit" | "not_hit" | "not_evaluable";

type NutritionDayProjection = Readonly<{
  day: string;
  status:
    | "hit"
    | "not_hit"
    | "no_log"
    | "in_progress"
    | "not_evaluable"
    | "excused";
  completed: boolean;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  entry_count: number;
}>;

export type NutritionLogSageContext = Readonly<{
  context_version: "nutrition_log_context_v1";
  delegated_view: boolean;
  active_state_ids: readonly string[];
  availability: Readonly<{
    nutrition_log: NutritionSourceState;
    plan: NutritionSourceState;
    recovery_adjustments: NutritionSourceState;
  }>;
  visible_window: Readonly<{
    start_day: string;
    end_day: string;
  }>;
  plan_context: unknown;
  recovery_context: Readonly<{
    today: string;
    active_nutrition_period: unknown;
  }>;
  summary: Readonly<{
    logged_days: number;
    finalized_days: number;
    in_progress_days: number;
    hit_days: number;
    average_finalized_kcal: number | null;
    average_finalized_protein_g: number | null;
  }>;
  monthly_summaries: readonly Readonly<
    Record<string, number | string | null>
  >[];
  days: readonly NutritionDayProjection[];
  recent_entry_labels: readonly Readonly<{
    day: string;
    labels: readonly string[];
    additional_entry_count: number;
  }>[];
}>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, maximum = 160): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null;
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
  const source = record(value);
  const first = firstNumber(source.lower ?? source.minimum ?? source.min);
  const second = firstNumber(source.upper ?? source.maximum ?? source.max);
  if (first == null || second == null) return null;
  return { lower: Math.min(first, second), upper: Math.max(first, second) };
}

function positiveInteger(value: unknown): number | null {
  const parsed = firstNumber(value);
  return parsed != null && Number.isInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

function readPlanNutritionTargets(value: unknown) {
  const targets = record(value);
  const calorieTarget = record(targets.calorie_target);
  const proteinTarget = record(targets.protein_target);
  const rollingCalories = record(calorieTarget.rolling_average_kcal);
  const weeklyProtein = record(proteinTarget.weekly_adherence);
  const adherenceRule = record(targets.adherence_rule);
  const dailyRangeKcal =
    numericRange(calorieTarget.daily_range_kcal) ?? numericRange(calorieTarget);
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

type PlanNutritionTargets = ReturnType<typeof readPlanNutritionTargets>;

function finite(value: number | null): value is number {
  return value != null && Number.isFinite(value);
}

// Keep this page projection aligned with the Nutrition Log's daily scoring
// semantics without adding Node-incompatible TypeScript imports to this module.
function scoreNutritionDay(
  observation: Readonly<{
    day: string;
    logged: boolean;
    finalized: boolean;
    adherenceExcluded: boolean;
    kcal: number | null;
    proteinG: number | null;
  }>,
  targets: PlanNutritionTargets,
) {
  if (observation.adherenceExcluded) {
    return { status: "excused" as const };
  }
  if (!observation.logged) {
    return { status: "no_log" as const };
  }
  if (!observation.finalized) {
    return { status: "in_progress" as const };
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
      return { status: "not_evaluable" as const };
    }
    return {
      status:
        calorieStatus === "hit" && proteinStatus === "hit"
          ? ("hit" as const)
          : ("not_hit" as const),
    };
  }

  if (targets.nominalKcal != null && !targets.dailyRangeKcal) {
    return { status: "not_evaluable" as const };
  }
  const primaryStatus = targets.dailyRangeKcal ? calorieStatus : proteinStatus;
  return { status: primaryStatus };
}

function hasPositiveTotal(totals: Record<string, unknown>): boolean {
  return ["kcal", "protein_g", "carbs_g", "fat_g"].some(
    (key) => (numberOrNull(totals[key]) ?? 0) > 0,
  );
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
  const targets = readPlanNutritionTargets(source.nutrition_targets);
  return boundedValue({
    primary_goal: text(source.primary_goal, 500) || null,
    phase: text(source.phase, 120) || null,
    phase_label: text(source.phase_label, 240) || null,
    nutrition_targets: {
      nominal_kcal: targets.nominalKcal,
      protein_minimum_g: targets.proteinMinimumG,
      daily_calorie_range: targets.dailyRangeKcal,
      rolling_calorie_range: targets.rollingAverageKcal,
      protein_weekly_adherence: targets.proteinWeeklyAdherence,
      daily_requires_both: targets.dailyRequiresBoth,
      weekly_requires_both: targets.weeklyRequiresBoth,
    },
    recovery_targets: source.recovery_targets ?? null,
    monitoring_rules: source.monitoring_rules ?? null,
  });
}

function activeNutritionPeriod(
  adjustments: readonly unknown[],
  today: string,
): unknown {
  for (const value of adjustments) {
    const period = record(record(value).nutrition_period);
    const startsOn = text(period.starts_on, 10);
    const endsOn = text(period.ends_on, 10);
    if (startsOn && endsOn && startsOn <= today && today <= endsOn) {
      return { starts_on: startsOn, ends_on: endsOn };
    }
  }
  return null;
}

function entryLabel(value: unknown): string {
  const source = record(value);
  const label = text(source.label, 120);
  if (!label) return "";
  const serving = text(source.serving_name, 80);
  const qtyServings = numberOrNull(source.qty_servings);
  const qtyGrams = numberOrNull(source.qty_g);
  const amount =
    serving && qtyServings != null
      ? `${qtyServings} ${serving}`
      : qtyGrams != null
        ? `${qtyGrams} g`
        : "";
  return amount ? `${label} — ${amount}` : label;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return (
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
    ) / 10
  );
}

export function projectNutritionLogSageContext(
  input: ProjectionInput,
): NutritionLogSageContext {
  const rangeSource = record(input.range);
  const rawDays =
    input.rangeState === "ready" && Array.isArray(rangeSource.days)
      ? rangeSource.days
      : [];
  const rangeReady =
    input.rangeState === "ready" && Array.isArray(rangeSource.days);
  const plan = input.planState === "ready" ? record(input.plan) : {};
  const targets = readPlanNutritionTargets(plan.nutrition_targets);
  const activeRecovery =
    input.recoveryState === "ready" && Array.isArray(input.recoveryAdjustments)
      ? activeNutritionPeriod(input.recoveryAdjustments, input.today)
      : null;

  const days = rawDays
    .map((value) => {
      const source = record(value);
      const dayRecord = record(source.day);
      const day = text(dayRecord.day, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
      const entries = Array.isArray(source.entries) ? source.entries : [];
      const totals = record(source.totals);
      const logged = entries.length > 0 || hasPositiveTotal(totals);
      const completed =
        day < input.today || Boolean(text(dayRecord.completed_at, 80));
      const scored = scoreNutritionDay(
        {
          day,
          logged,
          finalized: completed,
          adherenceExcluded: Boolean(activeRecovery) && day === input.today,
          kcal: numberOrNull(totals.kcal),
          proteinG: numberOrNull(totals.protein_g),
        },
        targets,
      );
      return {
        day,
        status: scored.status,
        completed,
        kcal: numberOrNull(totals.kcal),
        protein_g: numberOrNull(totals.protein_g),
        carbs_g: numberOrNull(totals.carbs_g),
        fat_g: numberOrNull(totals.fat_g),
        entry_count: entries.length,
        entries,
      };
    })
    .filter(
      (
        value,
      ): value is NutritionDayProjection & {
        entries: unknown[];
      } => value !== null,
    )
    .sort((left, right) => right.day.localeCompare(left.day));

  const loggedDays = days.filter(
    (day) =>
      day.entry_count > 0 ||
      [day.kcal, day.protein_g, day.carbs_g, day.fat_g].some(
        (value) => (value ?? 0) > 0,
      ),
  );
  const finalizedDays = loggedDays.filter((day) => day.completed);
  const months = new Map<
    string,
    {
      logged_days: number;
      finalized_days: number;
      in_progress_days: number;
      hit_days: number;
      kcal: number[];
      protein: number[];
    }
  >();

  for (const day of loggedDays) {
    const yearMonth = day.day.slice(0, 7);
    const summary = months.get(yearMonth) || {
      logged_days: 0,
      finalized_days: 0,
      in_progress_days: 0,
      hit_days: 0,
      kcal: [],
      protein: [],
    };
    summary.logged_days += 1;
    if (day.completed) summary.finalized_days += 1;
    else summary.in_progress_days += 1;
    if (day.status === "hit") summary.hit_days += 1;
    if (day.completed && day.kcal != null) summary.kcal.push(day.kcal);
    if (day.completed && day.protein_g != null) {
      summary.protein.push(day.protein_g);
    }
    months.set(yearMonth, summary);
  }

  const activeStates: string[] = [
    !rangeReady ? "load_error" : loggedDays.length === 0 ? "empty" : "ready",
  ];
  if (input.delegatedView) activeStates.push("delegated_read_only");
  if (activeRecovery) activeStates.push("recovery_adjustment_active");

  return {
    context_version: "nutrition_log_context_v1",
    delegated_view: input.delegatedView,
    active_state_ids: activeStates,
    availability: {
      nutrition_log: rangeReady ? "ready" : input.rangeState,
      plan: input.planState,
      recovery_adjustments: input.recoveryState,
    },
    visible_window: {
      start_day: input.startDay,
      end_day: input.endDay,
    },
    plan_context: input.planState === "ready" ? planProjection(plan) : null,
    recovery_context: {
      today: input.today,
      active_nutrition_period: activeRecovery,
    },
    summary: {
      logged_days: loggedDays.length,
      finalized_days: finalizedDays.length,
      in_progress_days: loggedDays.length - finalizedDays.length,
      hit_days: loggedDays.filter((day) => day.status === "hit").length,
      average_finalized_kcal: average(
        finalizedDays
          .map((day) => day.kcal)
          .filter((value): value is number => value != null),
      ),
      average_finalized_protein_g: average(
        finalizedDays
          .map((day) => day.protein_g)
          .filter((value): value is number => value != null),
      ),
    },
    monthly_summaries: [...months.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([year_month, summary]) => ({
        year_month,
        logged_days: summary.logged_days,
        finalized_days: summary.finalized_days,
        in_progress_days: summary.in_progress_days,
        hit_days: summary.hit_days,
        average_finalized_kcal: average(summary.kcal),
        average_finalized_protein_g: average(summary.protein),
      })),
    days: days.map(({ entries: _entries, ...day }) => day),
    recent_entry_labels: loggedDays.slice(0, 14).map((day) => {
      const labels = day.entries.map(entryLabel).filter(Boolean).slice(0, 8);
      return {
        day: day.day,
        labels,
        additional_entry_count: Math.max(0, day.entries.length - labels.length),
      };
    }),
  };
}
