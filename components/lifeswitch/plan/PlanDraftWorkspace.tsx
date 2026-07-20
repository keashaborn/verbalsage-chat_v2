"use client";

import * as React from "react";

export type JsonObject = Record<string, unknown>;

export type PlanDocument = {
  schema_version: number;
  phase: string;
  phase_label: string;
  primary_goal: string;
  start_date: string | null;
  review_date: string | null;
  review_cadence: string;
  body_state: JsonObject;
  nutrition_targets: JsonObject;
  training_targets: JsonObject;
  conditioning_targets: JsonObject;
  activity_targets: JsonObject;
  recovery_targets: JsonObject;
  monitoring_rules: JsonObject;
  coach_notes: string;
};

export type SageReviewFocus =
  | "whole_plan"
  | "direction"
  | "goal"
  | "schedule"
  | "body_state"
  | "nutrition_targets"
  | "training_targets"
  | "conditioning_targets"
  | "activity_targets"
  | "recovery_targets"
  | "monitoring_rules"
  | "coach_notes";

export type SagePlanReview = {
  summary: string;
  questions: Array<{
    field_path: string;
    question: string;
    why_needed: string;
  }>;
  suggestions: Array<{
    field_path: string;
    current_value: unknown;
    proposed_value: unknown;
    rationale: string;
    evidence: Array<{
      field_path: string;
      observed_value: unknown;
      explanation: string;
    }>;
    confidence: "low" | "medium" | "high";
    data_sufficiency: "insufficient" | "limited" | "sufficient";
  }>;
  observation_context: {
    as_of_local_date?: string;
    nutrition?: {
      status?: string;
      logged_days?: number;
      data_sufficiency?: string;
      calories?: {
        adherence?: { status?: string; reason?: string };
      };
      reason?: string;
    };
    measurements?: {
      status?: string;
      weight?: { observation_days?: number };
      waist?: { observation_days?: number };
      body_fat_percent?: { observation_days?: number };
      reason?: string;
    };
    training?: {
      status?: string;
      all_logged_resistance_sessions?: number;
      strength_sessions?: number;
      rehab_sessions?: number;
      strength_adherence?: {
        status?: string;
        reason?: string;
        rehab_exclusion_supported?: boolean;
      };
      reason?: string;
    };
    conditioning?: {
      status?: string;
      session_count?: number;
      data_sufficiency?: string;
      reason?: string;
    };
    activity?: {
      status?: string;
      steps?: { status?: string; reason?: string };
      reason?: string;
    };
    recovery?: { status?: string; reason?: string };
  };
  policy?: {
    ambiguity_routes?: Array<{
      code: string;
      route: string;
      detail: string;
    }>;
    rejected_suggestion_count?: number;
    rejected_reason_codes?: string[];
    research_gateway_status?: string;
  };
  provenance: {
    provider: string;
    model: string;
    response_id: string | null;
    draft_sha256: string;
    generated_at: string;
    writes_performed: false;
    requested_focus?: SageReviewFocus;
    effective_focus?: SageReviewFocus;
  };
};

type SectionKey =
  | "body_state"
  | "nutrition_targets"
  | "training_targets"
  | "conditioning_targets"
  | "activity_targets"
  | "recovery_targets"
  | "monitoring_rules";

type GuideStepId =
  | "direction"
  | "goal"
  | "schedule"
  | SectionKey
  | "coach_notes"
  | "review";

type PlanDraftWorkspaceProps = {
  revisionId: string;
  document: PlanDocument;
  saving: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (document: PlanDocument) => Promise<boolean>;
  onSageReview: (request: {
    focus: SageReviewFocus;
    user_request: string;
  }) => Promise<SagePlanReview>;
};

const SECTIONS: Array<{
  key: SectionKey;
  label: string;
  prompt: string;
}> = [
  {
    key: "body_state",
    label: "Current body state",
    prompt: "What measurements describe the starting point for this phase?",
  },
  {
    key: "nutrition_targets",
    label: "Nutrition targets",
    prompt: "What intake range and adherence targets support the goal?",
  },
  {
    key: "training_targets",
    label: "Strength training targets",
    prompt: "What training schedule and progression rules should be preserved?",
  },
  {
    key: "conditioning_targets",
    label: "Conditioning targets",
    prompt: "What conditioning dose, intensity, and mode fit the phase?",
  },
  {
    key: "activity_targets",
    label: "Daily activity targets",
    prompt: "What daily movement target should be monitored?",
  },
  {
    key: "recovery_targets",
    label: "Sleep and recovery",
    prompt: "What recovery expectations or warning signs matter?",
  },
  {
    key: "monitoring_rules",
    label: "Monitoring and adjustment rules",
    prompt: "What evidence should trigger continuation, review, or a change?",
  },
];

const GUIDE_STEPS: Array<{ id: GuideStepId; label: string }> = [
  { id: "direction", label: "Direction" },
  { id: "goal", label: "Goal" },
  { id: "schedule", label: "Schedule" },
  ...SECTIONS.map((section) => ({ id: section.key, label: section.label })),
  { id: "coach_notes", label: "Notes" },
  { id: "review", label: "Review" },
];

const PHASES = [
  ["cut", "Cut"],
  ["maintenance", "Maintenance"],
  ["lean_gain", "Lean gain"],
  ["recomp", "Recomposition"],
  ["other", "Other"],
] as const;

const SAGE_FOCUS_OPTIONS: Array<[SageReviewFocus, string]> = [
  ["whole_plan", "Whole Plan"],
  ["direction", "Direction"],
  ["goal", "Primary goal"],
  ["schedule", "Schedule and review"],
  ...SECTIONS.map(
    (section) => [section.key, section.label] as [SageReviewFocus, string],
  ),
  ["coach_notes", "Notes and context"],
];

function cloneDocument(document: PlanDocument): PlanDocument {
  return JSON.parse(JSON.stringify(document)) as PlanDocument;
}

function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pointerParts(path: string): string[] | null {
  if (!path.startsWith("/") || path === "/") return null;
  const parts = path
    .slice(1)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  const encoded = parts
    .map((part) => part.replaceAll("~", "~0").replaceAll("/", "~1"))
    .join("/");
  return encoded === path.slice(1) ? parts : null;
}

function applyPointerValue(
  document: PlanDocument,
  path: string,
  value: unknown,
): PlanDocument | null {
  const parts = pointerParts(path);
  if (!parts?.length) return null;
  const copy = cloneDocument(document);
  let current: JsonObject = copy as unknown as JsonObject;
  for (const part of parts.slice(0, -1)) {
    const child = current[part];
    if (!isPlainObject(child)) return null;
    current = child;
  }
  const field = parts[parts.length - 1];
  if (!(field in current)) return null;
  current[field] = JSON.parse(JSON.stringify(value)) as unknown;
  return copy;
}

function formatFieldPath(path: string): string {
  const parts = pointerParts(path);
  if (!parts) return path;
  const readable = parts.map((part, index) =>
    index === 0 && part === "context" ? "Logged data" : humanize(part),
  );
  return readable.join(" › ");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (isPlainObject(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${humanize(key)}: ${formatValue(item)}`)
      .join(" · ");
  }
  return String(value);
}

function unavailableDataLabel(reason?: string): string {
  if (reason === "permission_not_granted") return "Not shared with this coach";
  if (reason?.startsWith("no_canonical_")) return "Not connected yet";
  return "Unavailable";
}

function SageDataCoverage({
  context,
}: {
  context: SagePlanReview["observation_context"];
}) {
  const nutritionAvailable = context.nutrition?.status === "available";
  const measurementsAvailable = context.measurements?.status === "available";
  const trainingAvailable = context.training?.status?.startsWith("available");
  const conditioningAvailable = context.conditioning?.status === "available";
  const stepsAvailable = context.activity?.steps?.status === "available";
  const recoveryAvailable = context.recovery?.status === "available";
  const connectedCount = [
    nutritionAvailable,
    measurementsAvailable,
    trainingAvailable,
    conditioningAvailable,
    stepsAvailable,
    recoveryAvailable,
  ].filter(Boolean).length;
  const calorieRangeNeeded =
    context.nutrition?.calories?.adherence?.reason ===
    "point_target_has_no_acceptable_range";

  const items = [
    {
      label: "Nutrition",
      available: nutritionAvailable,
      detail: nutritionAvailable
        ? `${context.nutrition?.logged_days ?? 0} logged days · ${humanize(context.nutrition?.data_sufficiency || "unknown")} data${calorieRangeNeeded ? " · Calorie range needed" : ""}`
        : unavailableDataLabel(context.nutrition?.reason),
    },
    {
      label: "Measurements",
      available: measurementsAvailable,
      detail: measurementsAvailable
        ? `${context.measurements?.weight?.observation_days ?? 0} weight days · ${context.measurements?.waist?.observation_days ?? 0} waist days · ${context.measurements?.body_fat_percent?.observation_days ?? 0} body-fat days`
        : unavailableDataLabel(context.measurements?.reason),
    },
    {
      label: "Resistance training",
      available: Boolean(trainingAvailable),
      detail: trainingAvailable
        ? context.training?.strength_adherence?.rehab_exclusion_supported
          ? `${context.training?.strength_sessions ?? 0} strength sessions · ${context.training?.rehab_sessions ?? 0} sessions containing rehab`
          : `${context.training?.all_logged_resistance_sessions ?? 0} logged sessions · Rehab is not separated yet`
        : unavailableDataLabel(context.training?.reason),
    },
    {
      label: "Conditioning",
      available: conditioningAvailable,
      detail: conditioningAvailable
        ? `${context.conditioning?.session_count ?? 0} logged sessions · ${humanize(context.conditioning?.data_sufficiency || "unknown")} data`
        : unavailableDataLabel(context.conditioning?.reason),
    },
    {
      label: "Steps",
      available: stepsAvailable,
      detail: stepsAvailable
        ? "Connected"
        : unavailableDataLabel(context.activity?.steps?.reason),
    },
    {
      label: "Recovery",
      available: recoveryAvailable,
      detail: recoveryAvailable
        ? "Connected"
        : unavailableDataLabel(context.recovery?.reason),
    },
  ];

  return (
    <details className="max-w-full min-w-0 overflow-hidden rounded-2xl border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold break-words">
        Data Sage used · {connectedCount} of {items.length} sources connected
      </summary>
      <div className="grid gap-2 border-t p-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex min-w-0 items-start justify-between gap-3 rounded-xl bg-muted/35 p-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="mt-0.5 text-xs [overflow-wrap:anywhere] text-muted-foreground">
                {item.detail}
              </div>
            </div>
            <span
              className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.available ? "bg-emerald-500" : "bg-muted-foreground/35"}`}
              aria-label={item.available ? "Connected" : "Unavailable"}
            />
          </div>
        ))}
        {context.as_of_local_date ? (
          <div className="min-w-0 px-1 text-[11px] [overflow-wrap:anywhere] text-muted-foreground">
            Through {context.as_of_local_date}. Deterministic summaries only; no
            raw log was given to Sage.
          </div>
        ) : null}
      </div>
    </details>
  );
}

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.some(isMeaningful);
  if (isPlainObject(value)) return Object.values(value).some(isMeaningful);
  return true;
}

function leafCounts(value: unknown): { filled: number; total: number } {
  if (isPlainObject(value)) {
    const entries = Object.values(value);
    if (!entries.length) return { filled: 0, total: 0 };
    return entries.reduce<{ filled: number; total: number }>(
      (sum, item) => {
        const next = leafCounts(item);
        return {
          filled: sum.filled + next.filled,
          total: sum.total + next.total,
        };
      },
      { filled: 0, total: 0 },
    );
  }
  if (Array.isArray(value)) {
    if (!value.length) return { filled: 0, total: 1 };
    return value.reduce<{ filled: number; total: number }>(
      (sum, item) => {
        const next = leafCounts(item);
        return {
          filled: sum.filled + next.filled,
          total: sum.total + next.total,
        };
      },
      { filled: 0, total: 0 },
    );
  }
  return { filled: isMeaningful(value) ? 1 : 0, total: 1 };
}

function progressLabel(value: unknown): string {
  const counts = leafCounts(value);
  if (!counts.total || !counts.filled) return "Needs information";
  if (counts.filled < counts.total) return "In progress";
  return "Complete";
}

function updateNestedValue(
  value: JsonObject,
  path: string[],
  nextValue: unknown,
): JsonObject {
  const copy = JSON.parse(JSON.stringify(value)) as JsonObject;
  let current = copy;
  path.slice(0, -1).forEach((part) => {
    const existing = current[part];
    if (!isPlainObject(existing)) current[part] = {};
    current = current[part] as JsonObject;
  });
  current[path[path.length - 1]] = nextValue;
  return copy;
}

function PrimitiveField({
  fieldKey,
  value,
  onChange,
}: {
  fieldKey: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = humanize(fieldKey);
  const id = React.useId();
  if (typeof value === "boolean") {
    return (
      <label
        htmlFor={id}
        className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"
      >
        <span className="font-medium">{label}</span>
        <input
          id={id}
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(event.target.checked)}
          className="size-5"
        />
      </label>
    );
  }

  if (typeof value === "number") {
    return (
      <label htmlFor={id} className="grid gap-1.5 text-sm">
        <span className="font-medium">{label}</span>
        <input
          id={id}
          type="number"
          value={Number.isFinite(value) ? value : ""}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? "" : Number(event.target.value),
            )
          }
          className="rounded-xl border bg-background px-3 py-2.5"
        />
      </label>
    );
  }

  if (Array.isArray(value)) {
    return (
      <label htmlFor={id} className="grid gap-1.5 text-sm">
        <span className="font-medium">{label}</span>
        <textarea
          id={id}
          value={value.map(String).join("\n")}
          onChange={(event) =>
            onChange(
              event.target.value
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
          rows={3}
          className="rounded-xl border bg-background px-3 py-2.5"
        />
      </label>
    );
  }

  const stringValue =
    value === null || value === undefined ? "" : String(value);
  const useTextarea =
    stringValue.length > 60 ||
    /(notes|rule|summary|goal|constraints|structure|priority)/i.test(fieldKey);
  return (
    <label htmlFor={id} className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {useTextarea ? (
        <textarea
          id={id}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="rounded-xl border bg-background px-3 py-2.5"
        />
      ) : (
        <input
          id={id}
          type="text"
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-xl border bg-background px-3 py-2.5"
        />
      )}
    </label>
  );
}

function ObjectFields({
  value,
  onChange,
  path = [],
}: {
  value: JsonObject;
  onChange: (path: string[], value: unknown) => void;
  path?: string[];
}) {
  const entries = Object.entries(value);
  if (!entries.length) {
    return (
      <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
        No fields are defined in this section yet.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      {entries.map(([key, item]) => {
        if (isPlainObject(item)) {
          return (
            <fieldset key={key} className="grid gap-3 rounded-xl border p-3">
              <legend className="px-1 text-sm font-semibold">
                {humanize(key)}
              </legend>
              <ObjectFields
                value={item}
                path={[...path, key]}
                onChange={onChange}
              />
            </fieldset>
          );
        }
        return (
          <PrimitiveField
            key={key}
            fieldKey={key}
            value={item}
            onChange={(nextValue) => onChange([...path, key], nextValue)}
          />
        );
      })}
    </div>
  );
}

function numericFieldValue(value: unknown): string | number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() &&
    Number.isFinite(Number(value))
  ) {
    return value;
  }
  return "";
}

function optionalNumber(value: unknown): number | null {
  const numeric = numericFieldValue(value);
  return numeric === "" ? null : Number(numeric);
}

function NumberTargetField({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: unknown;
  unit: string;
  onChange: (value: number | null) => void;
}) {
  const id = React.useId();
  return (
    <label htmlFor={id} className="grid min-w-0 gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex min-w-0 items-center rounded-xl border bg-background focus-within:ring-2 focus-within:ring-ring/50">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={numericFieldValue(value)}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
          className="min-w-0 flex-1 bg-transparent px-3 py-3 outline-none"
        />
        <span className="shrink-0 pr-3 text-xs text-muted-foreground">
          {unit}
        </span>
      </div>
    </label>
  );
}

const STRUCTURED_NUTRITION_KEYS = new Set([
  "calories",
  "target_kcal",
  "calorie_target",
  "calorie_range",
  "protein",
  "protein_g",
  "protein_minimum_g",
  "protein_grams_minimum",
  "protein_target",
  "adherence_rule",
]);

function NutritionTargetsEditor({
  value,
  onChange,
}: {
  value: JsonObject;
  onChange: (value: JsonObject) => void;
}) {
  const calorieRaw = value.calorie_target;
  const calorieObject = isPlainObject(calorieRaw) ? calorieRaw : {};
  const structuredCalories =
    "nominal_kcal" in calorieObject ||
    "daily_range_kcal" in calorieObject ||
    "rolling_average_kcal" in calorieObject;
  const dailyObject = isPlainObject(calorieObject.daily_range_kcal)
    ? calorieObject.daily_range_kcal
    : !structuredCalories
      ? calorieObject
      : {};
  const rollingObject = isPlainObject(calorieObject.rolling_average_kcal)
    ? calorieObject.rolling_average_kcal
    : {};
  const proteinObject = isPlainObject(value.protein_target)
    ? value.protein_target
    : {};
  const proteinWeekly = isPlainObject(proteinObject.weekly_adherence)
    ? proteinObject.weekly_adherence
    : {};
  const adherenceRule = isPlainObject(value.adherence_rule)
    ? value.adherence_rule
    : {};

  const nominalCalories = structuredCalories
    ? calorieObject.nominal_kcal
    : (value.calories ??
      value.target_kcal ??
      (!isPlainObject(calorieRaw) ? calorieRaw : null));
  const proteinMinimum =
    proteinObject.minimum_g ??
    value.protein_grams_minimum ??
    value.protein_minimum_g ??
    value.protein_g ??
    value.protein;

  function normalizedValue(): JsonObject {
    const next = JSON.parse(JSON.stringify(value)) as JsonObject;
    next.calorie_target = {
      ...(structuredCalories ? calorieObject : {}),
      nominal_kcal: optionalNumber(nominalCalories),
      daily_range_kcal: {
        lower: optionalNumber(dailyObject.lower),
        upper: optionalNumber(dailyObject.upper),
      },
      rolling_average_kcal: {
        window_days: optionalNumber(rollingObject.window_days),
        lower: optionalNumber(rollingObject.lower),
        upper: optionalNumber(rollingObject.upper),
      },
    };
    next.protein_target = {
      ...proteinObject,
      minimum_g: optionalNumber(proteinMinimum),
      weekly_adherence: {
        mode: typeof proteinWeekly.mode === "string" ? proteinWeekly.mode : "",
        window_days: optionalNumber(proteinWeekly.window_days),
        required_hit_days: optionalNumber(proteinWeekly.required_hit_days),
      },
    };
    next.adherence_rule = {
      daily_requires_both_calorie_and_protein:
        typeof adherenceRule.daily_requires_both_calorie_and_protein ===
        "boolean"
          ? adherenceRule.daily_requires_both_calorie_and_protein
          : null,
      weekly_requires_both_calorie_and_protein:
        typeof adherenceRule.weekly_requires_both_calorie_and_protein ===
        "boolean"
          ? adherenceRule.weekly_requires_both_calorie_and_protein
          : null,
    };
    return next;
  }

  function setKnown(path: string[], nextValue: unknown) {
    const next = updateNestedValue(normalizedValue(), path, nextValue);
    if (path.join("/") === "calorie_target/nominal_kcal") {
      next.calories = nextValue === null ? "" : String(nextValue);
    }
    if (path.join("/") === "protein_target/minimum_g") {
      next.protein_g = nextValue === null ? "" : String(nextValue);
    }
    onChange(next);
  }

  const remaining = Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => !STRUCTURED_NUTRITION_KEYS.has(key),
    ),
  );
  const dailyCombined =
    typeof adherenceRule.daily_requires_both_calorie_and_protein === "boolean"
      ? String(adherenceRule.daily_requires_both_calorie_and_protein)
      : "";
  const weeklyCombined =
    typeof adherenceRule.weekly_requires_both_calorie_and_protein === "boolean"
      ? String(adherenceRule.weekly_requires_both_calorie_and_protein)
      : "";

  return (
    <div className="grid min-w-0 gap-4">
      <fieldset className="grid min-w-0 gap-3 rounded-2xl border p-3">
        <legend className="px-1 text-sm font-semibold">Calories</legend>
        <NumberTargetField
          label="Nominal daily target"
          value={nominalCalories}
          unit="kcal"
          onChange={(next) =>
            setKnown(["calorie_target", "nominal_kcal"], next)
          }
        />
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <NumberTargetField
            label="Daily acceptable minimum"
            value={dailyObject.lower}
            unit="kcal"
            onChange={(next) =>
              setKnown(["calorie_target", "daily_range_kcal", "lower"], next)
            }
          />
          <NumberTargetField
            label="Daily acceptable maximum"
            value={dailyObject.upper}
            unit="kcal"
            onChange={(next) =>
              setKnown(["calorie_target", "daily_range_kcal", "upper"], next)
            }
          />
        </div>
        <p className="text-xs text-muted-foreground">
          A day is not scored hit or miss until both daily bounds are set.
        </p>
        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          <NumberTargetField
            label="Average window"
            value={rollingObject.window_days}
            unit="days"
            onChange={(next) =>
              setKnown(
                ["calorie_target", "rolling_average_kcal", "window_days"],
                next,
              )
            }
          />
          <NumberTargetField
            label="Average minimum"
            value={rollingObject.lower}
            unit="kcal"
            onChange={(next) =>
              setKnown(
                ["calorie_target", "rolling_average_kcal", "lower"],
                next,
              )
            }
          />
          <NumberTargetField
            label="Average maximum"
            value={rollingObject.upper}
            unit="kcal"
            onChange={(next) =>
              setKnown(
                ["calorie_target", "rolling_average_kcal", "upper"],
                next,
              )
            }
          />
        </div>
      </fieldset>

      <fieldset className="grid min-w-0 gap-3 rounded-2xl border p-3">
        <legend className="px-1 text-sm font-semibold">Protein</legend>
        <NumberTargetField
          label="Daily minimum"
          value={proteinMinimum}
          unit="g"
          onChange={(next) => setKnown(["protein_target", "minimum_g"], next)}
        />
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Weekly scoring method</span>
          <select
            value={
              typeof proteinWeekly.mode === "string" ? proteinWeekly.mode : ""
            }
            onChange={(event) =>
              setKnown(
                ["protein_target", "weekly_adherence", "mode"],
                event.target.value,
              )
            }
            className="rounded-xl border bg-background px-3 py-3"
          >
            <option value="">Not set</option>
            <option value="days_hit">Days meeting minimum</option>
          </select>
        </label>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <NumberTargetField
            label="Weekly window"
            value={proteinWeekly.window_days}
            unit="days"
            onChange={(next) =>
              setKnown(
                ["protein_target", "weekly_adherence", "window_days"],
                next,
              )
            }
          />
          <NumberTargetField
            label="Required hit days"
            value={proteinWeekly.required_hit_days}
            unit="days"
            onChange={(next) =>
              setKnown(
                ["protein_target", "weekly_adherence", "required_hit_days"],
                next,
              )
            }
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Days hit is the primary adherence measure. Weekly average remains
          supporting context and cannot hide low-protein days.
        </p>
      </fieldset>

      <fieldset className="grid min-w-0 gap-3 rounded-2xl border p-3">
        <legend className="px-1 text-sm font-semibold">Combined scoring</legend>
        {[
          [
            "Daily hit requires calories and protein",
            dailyCombined,
            "daily_requires_both_calorie_and_protein",
          ],
          [
            "Weekly success requires calories and protein",
            weeklyCombined,
            "weekly_requires_both_calorie_and_protein",
          ],
        ].map(([label, selected, key]) => (
          <label key={key} className="grid gap-1.5 text-sm">
            <span className="font-medium">{label}</span>
            <select
              value={selected}
              onChange={(event) =>
                setKnown(
                  ["adherence_rule", key],
                  event.target.value === ""
                    ? null
                    : event.target.value === "true",
                )
              }
              className="rounded-xl border bg-background px-3 py-3"
            >
              <option value="">Not set</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
        ))}
      </fieldset>

      {Object.keys(remaining).length ? (
        <fieldset className="grid gap-3 rounded-2xl border p-3">
          <legend className="px-1 text-sm font-semibold">
            Additional nutrition fields
          </legend>
          <ObjectFields
            value={remaining}
            onChange={(path, nextValue) =>
              onChange(updateNestedValue(value, path, nextValue))
            }
          />
        </fieldset>
      ) : null}
    </div>
  );
}

function ProgressBadge({ value }: { value: unknown }) {
  const label = progressLabel(value);
  return (
    <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      {label}
    </span>
  );
}

export function PlanDraftWorkspace({
  revisionId,
  document,
  saving,
  onDirtyChange,
  onSave,
  onSageReview,
}: PlanDraftWorkspaceProps) {
  const [draft, setDraft] = React.useState<PlanDocument>(() =>
    cloneDocument(document),
  );
  const [baseline, setBaseline] = React.useState(() =>
    JSON.stringify(document),
  );
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [sageOpen, setSageOpen] = React.useState(false);
  const [sageReviewing, setSageReviewing] = React.useState(false);
  const [sageError, setSageError] = React.useState("");
  const [sageFocus, setSageFocus] =
    React.useState<SageReviewFocus>("whole_plan");
  const [sageRequest, setSageRequest] = React.useState("");
  const [sageReview, setSageReview] = React.useState<SagePlanReview | null>(
    null,
  );
  const [suggestionStates, setSuggestionStates] = React.useState<
    Record<string, "applied" | "dismissed">
  >({});

  React.useEffect(() => {
    setDraft(cloneDocument(document));
    setBaseline(JSON.stringify(document));
    setGuideOpen(false);
    setStepIndex(0);
    setSageOpen(false);
    setSageError("");
    setSageReview(null);
    setSuggestionStates({});
  }, [document, revisionId]);

  const serializedDraft = JSON.stringify(draft);
  const dirty = serializedDraft !== baseline;

  React.useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  function openStep(step: GuideStepId) {
    const index = GUIDE_STEPS.findIndex((item) => item.id === step);
    setStepIndex(Math.max(index, 0));
    setGuideOpen(true);
  }

  function updateSection(section: SectionKey, path: string[], value: unknown) {
    setDraft((current) => ({
      ...current,
      [section]: updateNestedValue(current[section], path, value),
    }));
  }

  async function saveDraft(closeAfterSave: boolean) {
    if (!dirty) {
      if (closeAfterSave) setGuideOpen(false);
      return;
    }
    const saved = await onSave(draft);
    if (!saved) return;
    setBaseline(serializedDraft);
    if (closeAfterSave) setGuideOpen(false);
  }

  async function requestSageReview() {
    if (dirty || sageReviewing) return;
    setSageReviewing(true);
    setSageError("");
    try {
      const review = await onSageReview({
        focus: sageFocus,
        user_request: sageRequest.trim(),
      });
      setSageReview(review);
      setSuggestionStates({});
    } catch (caught) {
      setSageError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSageReviewing(false);
    }
  }

  function applySuggestion(fieldPath: string, proposedValue: unknown) {
    setDraft((current) => {
      const next = applyPointerValue(current, fieldPath, proposedValue);
      return next || current;
    });
    setSuggestionStates((current) => ({
      ...current,
      [fieldPath]: "applied",
    }));
  }

  const step = GUIDE_STEPS[stepIndex];
  const section = SECTIONS.find((item) => item.key === step?.id);

  return (
    <div
      className="grid gap-4 rounded-2xl border bg-muted/20 p-3 sm:p-4"
      data-testid="plan-draft-workspace"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Inactive draft workspace
          </div>
          <h2 className="mt-1 text-lg font-semibold">
            Build the next Plan version
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Work section by section. Saving updates only this draft; the active
            Plan remains unchanged until owner approval.
          </p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-medium">
          {dirty ? "Unsaved changes" : "Draft saved"}
        </span>
      </div>

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={() => openStep("direction")}
          className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          Guide me through the Plan
        </button>
        <button
          type="button"
          disabled={sageReviewing || (dirty && !sageReview)}
          title={
            dirty && !sageReview
              ? "Save the draft before asking Sage to review it."
              : undefined
          }
          onClick={() => setSageOpen(true)}
          className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {sageReview ? "Review Sage suggestions" : "Ask Sage to review"}
        </button>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void saveDraft(false)}
          className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save draft"}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => openStep("direction")}
          className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 text-left"
        >
          <span>
            <span className="block text-sm font-semibold">
              Direction and goal
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {draft.phase_label || humanize(draft.phase)}
            </span>
          </span>
          <ProgressBadge
            value={[draft.phase, draft.phase_label, draft.primary_goal]}
          />
        </button>
        <button
          type="button"
          onClick={() => openStep("schedule")}
          className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 text-left"
        >
          <span>
            <span className="block text-sm font-semibold">
              Schedule and review
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {draft.review_date
                ? `Review ${draft.review_date}`
                : "No review date"}
            </span>
          </span>
          <ProgressBadge
            value={[draft.start_date, draft.review_date, draft.review_cadence]}
          />
        </button>
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => openStep(item.key)}
            className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 text-left"
          >
            <span className="text-sm font-semibold">{item.label}</span>
            <ProgressBadge value={draft[item.key]} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => openStep("coach_notes")}
          className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 text-left"
        >
          <span className="text-sm font-semibold">Coach notes</span>
          {draft.coach_notes ? (
            <ProgressBadge value={draft.coach_notes} />
          ) : (
            <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Optional
            </span>
          )}
        </button>
      </div>

      {sageOpen ? (
        <div
          className="fixed inset-0 z-[90] overflow-x-hidden overflow-y-auto bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="Sage Plan review"
        >
          <div className="mx-auto flex min-h-full w-full max-w-3xl min-w-0 flex-col overflow-x-hidden">
            <header className="sticky top-0 z-10 w-full min-w-0 border-b bg-background/95 px-4 py-3 backdrop-blur">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Bounded Plan assistance
                  </div>
                  <div className="text-lg font-semibold">Sage Plan review</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSageOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Close
                </button>
              </div>
            </header>

            <main className="grid w-full min-w-0 flex-1 content-start gap-4 overflow-x-hidden px-4 py-6">
              <div className="max-w-full min-w-0 rounded-xl border bg-muted/30 p-3 text-sm [overflow-wrap:anywhere] text-muted-foreground">
                Sage can read this saved inactive draft, deterministic
                validation, and bounded summaries from the LifeSwitch data you
                are allowed to view. It cannot save, submit, approve, or
                activate a Plan. You decide whether any suggestion enters the
                editable draft.
              </div>

              {sageError ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {sageError}
                </div>
              ) : null}

              {!sageReview ? (
                <div className="grid max-w-full min-w-0 gap-4 overflow-hidden rounded-2xl border p-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      What should Sage review?
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose a section or request a review of the complete Plan.
                      Add a question only if you want Sage to focus on something
                      specific.
                    </p>
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Review focus</span>
                    <select
                      value={sageFocus}
                      onChange={(event) =>
                        setSageFocus(event.target.value as SageReviewFocus)
                      }
                      className="rounded-xl border bg-background px-3 py-3"
                    >
                      {SAGE_FOCUS_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      Question for Sage (optional)
                    </span>
                    <textarea
                      value={sageRequest}
                      maxLength={1200}
                      onChange={(event) => setSageRequest(event.target.value)}
                      rows={4}
                      placeholder="For example: Is this goal measurable enough?"
                      className="rounded-xl border bg-background px-3 py-3"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={dirty || sageReviewing}
                    onClick={() => void requestSageReview()}
                    className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {sageReviewing
                      ? "Sage is reviewing…"
                      : "Review saved draft"}
                  </button>
                  {dirty ? (
                    <p className="text-xs text-muted-foreground">
                      Close this panel and save the draft before requesting a
                      new review.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="grid max-w-full min-w-0 gap-4 overflow-hidden">
                  <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border p-4">
                    <h3 className="text-sm font-semibold">Sage summary</h3>
                    <p className="mt-2 text-sm [overflow-wrap:anywhere] whitespace-pre-wrap">
                      {sageReview.summary}
                    </p>
                  </section>

                  <SageDataCoverage
                    context={sageReview.observation_context || {}}
                  />

                  {(sageReview.policy?.rejected_suggestion_count || 0) > 0 ? (
                    <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                      Sage withheld{" "}
                      {sageReview.policy?.rejected_suggestion_count} unsupported
                      or contradictory recommendation
                      {sageReview.policy?.rejected_suggestion_count === 1
                        ? ""
                        : "s"}
                      .
                    </div>
                  ) : null}

                  {sageReview.questions.length ? (
                    <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border p-4">
                      <h3 className="font-semibold">
                        Information Sage still needs
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Use these questions while completing the guide, save the
                        answers, then request another review.
                      </p>
                      <div className="mt-3 grid gap-3">
                        {sageReview.questions.map((question) => (
                          <div
                            key={`${question.field_path}:${question.question}`}
                            className="max-w-full min-w-0 overflow-hidden rounded-xl bg-muted/40 p-3 [overflow-wrap:anywhere]"
                          >
                            <div className="text-xs font-medium text-muted-foreground">
                              {formatFieldPath(question.field_path)}
                            </div>
                            <div className="mt-1 text-sm font-medium">
                              {question.question}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {question.why_needed}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <section className="grid max-w-full min-w-0 gap-3 overflow-hidden">
                    <div className="min-w-0 [overflow-wrap:anywhere]">
                      <h3 className="font-semibold">Proposed draft edits</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Applying an edit changes only the local inactive draft.
                        It remains unsaved until you press Save draft.
                      </p>
                    </div>
                    {sageReview.suggestions.length ? (
                      sageReview.suggestions.map((suggestion) => {
                        const suggestionState =
                          suggestionStates[suggestion.field_path];
                        return (
                          <article
                            key={suggestion.field_path}
                            className="grid max-w-full min-w-0 gap-3 overflow-hidden rounded-2xl border p-4"
                          >
                            <div className="flex max-w-full min-w-0 flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                                {formatFieldPath(suggestion.field_path)}
                              </div>
                              <div className="flex max-w-full min-w-0 flex-wrap gap-2 text-[11px] text-muted-foreground">
                                <span className="rounded-full border px-2 py-1">
                                  {humanize(suggestion.confidence)} confidence
                                </span>
                                <span className="rounded-full border px-2 py-1">
                                  {humanize(suggestion.data_sufficiency)} data
                                </span>
                              </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="rounded-xl bg-muted/40 p-3">
                                <div className="text-xs font-medium text-muted-foreground">
                                  Current
                                </div>
                                <div className="mt-1 text-sm break-words">
                                  {formatValue(suggestion.current_value)}
                                </div>
                              </div>
                              <div className="rounded-xl bg-primary/5 p-3">
                                <div className="text-xs font-medium text-muted-foreground">
                                  Sage proposes
                                </div>
                                <div className="mt-1 text-sm font-medium break-words">
                                  {formatValue(suggestion.proposed_value)}
                                </div>
                              </div>
                            </div>
                            <p className="min-w-0 text-sm [overflow-wrap:anywhere]">
                              {suggestion.rationale}
                            </p>
                            <details className="max-w-full min-w-0 overflow-hidden rounded-xl border">
                              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                                Supporting evidence
                              </summary>
                              <div className="grid gap-2 border-t p-3">
                                {suggestion.evidence.map((evidence) => (
                                  <div
                                    key={`${suggestion.field_path}:${evidence.field_path}`}
                                    className="min-w-0 text-sm [overflow-wrap:anywhere]"
                                  >
                                    <span className="font-medium">
                                      {formatFieldPath(evidence.field_path)}:
                                    </span>{" "}
                                    {formatValue(evidence.observed_value)}
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      {evidence.explanation}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </details>
                            <div className="grid max-w-full min-w-0 gap-2 sm:flex">
                              <button
                                type="button"
                                disabled={Boolean(suggestionState)}
                                onClick={() =>
                                  applySuggestion(
                                    suggestion.field_path,
                                    suggestion.proposed_value,
                                  )
                                }
                                className="w-full min-w-0 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
                              >
                                {suggestionState === "applied"
                                  ? "Applied to draft"
                                  : "Apply to draft"}
                              </button>
                              <button
                                type="button"
                                disabled={Boolean(suggestionState)}
                                onClick={() =>
                                  setSuggestionStates((current) => ({
                                    ...current,
                                    [suggestion.field_path]: "dismissed",
                                  }))
                                }
                                className="w-full min-w-0 rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50 sm:w-auto"
                              >
                                {suggestionState === "dismissed"
                                  ? "Dismissed"
                                  : "Dismiss"}
                              </button>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                        Sage found no evidence-supported field edit to propose.
                      </div>
                    )}
                  </section>

                  <div className="grid max-w-full min-w-0 gap-2 overflow-hidden sm:flex sm:items-center sm:justify-between">
                    <button
                      type="button"
                      disabled={dirty}
                      title={
                        dirty
                          ? "Save applied suggestions before requesting another review."
                          : undefined
                      }
                      onClick={() => {
                        setSageReview(null);
                        setSageError("");
                        setSuggestionStates({});
                      }}
                      className="w-full min-w-0 rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50 sm:w-auto"
                    >
                      Start another review
                    </button>
                    <div className="min-w-0 text-xs [overflow-wrap:anywhere] text-muted-foreground">
                      {sageReview.provenance.model} · Saved draft + bounded
                      canonical summaries · No writes
                    </div>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      ) : null}

      {guideOpen ? (
        <div
          className="fixed inset-0 z-[80] overflow-y-auto bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="Guided Plan setup"
        >
          <div className="mx-auto flex min-h-full max-w-3xl flex-col">
            <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Guided Plan setup
                  </div>
                  <div className="text-sm font-semibold">
                    Step {stepIndex + 1} of {GUIDE_STEPS.length}: {step.label}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGuideOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Close
                </button>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${((stepIndex + 1) / GUIDE_STEPS.length) * 100}%`,
                  }}
                />
              </div>
            </header>

            <main className="flex-1 px-4 py-6">
              {step.id === "direction" ? (
                <div className="grid gap-4">
                  <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    This guide edits the inactive draft directly. Sage review is
                    available from the draft workspace; applying a
                    recommendation creates an unsaved edit and never saves or
                    activates the Plan.
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">
                      What direction is this Plan taking?
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose the phase and give it a plain-language name.
                    </p>
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Phase</span>
                    <select
                      value={draft.phase}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          phase: event.target.value,
                        }))
                      }
                      className="rounded-xl border bg-background px-3 py-3"
                    >
                      {PHASES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Phase name</span>
                    <input
                      value={draft.phase_label}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          phase_label: event.target.value,
                        }))
                      }
                      className="rounded-xl border bg-background px-3 py-3"
                    />
                  </label>
                </div>
              ) : null}

              {step.id === "goal" ? (
                <div className="grid gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">
                      What should this phase accomplish?
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Describe the outcome clearly enough to guide nutrition,
                      training, and measurement decisions.
                    </p>
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Primary goal</span>
                    <textarea
                      value={draft.primary_goal}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          primary_goal: event.target.value,
                        }))
                      }
                      rows={6}
                      className="rounded-xl border bg-background px-3 py-3"
                    />
                  </label>
                </div>
              ) : null}

              {step.id === "schedule" ? (
                <div className="grid gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">
                      When will the Plan be reviewed?
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A review date creates a boundary for collecting enough
                      observations before changing course.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Start date</span>
                      <input
                        type="date"
                        value={draft.start_date || ""}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            start_date: event.target.value || null,
                          }))
                        }
                        className="rounded-xl border bg-background px-3 py-3"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Next review</span>
                      <input
                        type="date"
                        value={draft.review_date || ""}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            review_date: event.target.value || null,
                          }))
                        }
                        className="rounded-xl border bg-background px-3 py-3"
                      />
                    </label>
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Review cadence</span>
                    <input
                      value={draft.review_cadence}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          review_cadence: event.target.value,
                        }))
                      }
                      className="rounded-xl border bg-background px-3 py-3"
                    />
                  </label>
                </div>
              ) : null}

              {section ? (
                <div className="grid gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">{section.label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {section.prompt}
                    </p>
                  </div>
                  {section.key === "nutrition_targets" ? (
                    <NutritionTargetsEditor
                      value={draft.nutrition_targets}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          nutrition_targets: value,
                        }))
                      }
                    />
                  ) : (
                    <ObjectFields
                      value={draft[section.key]}
                      onChange={(path, value) =>
                        updateSection(section.key, path, value)
                      }
                    />
                  )}
                </div>
              ) : null}

              {step.id === "coach_notes" ? (
                <div className="grid gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Notes and context</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Record constraints, preferences, or coaching context that
                      should remain attached to the Plan.
                    </p>
                  </div>
                  <textarea
                    value={draft.coach_notes}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        coach_notes: event.target.value,
                      }))
                    }
                    rows={8}
                    className="rounded-xl border bg-background px-3 py-3"
                    aria-label="Coach notes"
                  />
                </div>
              ) : null}

              {step.id === "review" ? (
                <div className="grid gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Review the draft</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Save this draft before returning to the change-review and
                      approval workflow.
                    </p>
                  </div>
                  <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Phase
                      </dt>
                      <dd className="mt-1 text-sm font-semibold">
                        {draft.phase_label || humanize(draft.phase)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Review
                      </dt>
                      <dd className="mt-1 text-sm">
                        {draft.review_date || "Not set"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium text-muted-foreground">
                        Primary goal
                      </dt>
                      <dd className="mt-1 text-sm whitespace-pre-wrap">
                        {draft.primary_goal || "Not set"}
                      </dd>
                    </div>
                  </dl>
                  <div className="grid gap-2 sm:flex">
                    <button
                      type="button"
                      disabled={!dirty || saving}
                      onClick={() => void saveDraft(true)}
                      className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {saving
                        ? "Saving…"
                        : dirty
                          ? "Save draft and close"
                          : "Draft already saved"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStepIndex(0)}
                      className="rounded-xl border px-4 py-3 text-sm font-semibold"
                    >
                      Review again
                    </button>
                  </div>
                </div>
              ) : null}
            </main>

            <footer className="sticky bottom-0 border-t bg-background/95 px-4 py-3 backdrop-blur">
              <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={stepIndex === 0}
                  onClick={() =>
                    setStepIndex((current) => Math.max(0, current - 1))
                  }
                  className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-40"
                >
                  Back
                </button>
                {stepIndex < GUIDE_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setStepIndex((current) =>
                        Math.min(GUIDE_STEPS.length - 1, current + 1),
                      )
                    }
                    className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                  >
                    Continue
                  </button>
                ) : null}
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
