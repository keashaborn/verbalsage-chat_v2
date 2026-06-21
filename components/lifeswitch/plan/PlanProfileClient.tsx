"use client";

import * as React from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";

type JsonObject = Record<string, unknown>;

type PlanProfile = {
  plan_profile_id: string;
  owner_user_id: string;
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type PhaseDraft = {
  phase: string;
  phase_label: string;
  primary_goal: string;
  start_date: string;
  review_date: string;
  review_cadence: string;
  coach_notes: string;
};

type NutritionDraft = {
  calories: string;
  protein_g: string;
  macro_notes: string;
  meal_structure: string;
  adherence_target: string;
};

type TrainingDraft = {
  split: string;
  workouts_per_week: string;
  priority_areas: string;
  progression_rule: string;
  recovery_constraints: string;
};

type BodyStateDraft = {
  weight_lb: string;
  waist_in: string;
  measurements: string;
  body_fat_percent: string;
  measurement_method: string;
  calipers: string;
  body_scan: string;
};

type RecoveryDraft = {
  sleep_hours: string;
  rest_days: string;
  mobility_goal: string;
  fatigue_watch: string;
};

type ConditioningActivityDraft = {
  cardio_target: string;
  preferred_mode: string;
  intensity: string;
  steps_per_day: string;
  wearable_source: string;
};

type MonitoringDraft = {
  summary: string;
  weight_trend_rule: string;
  nutrition_adherence_rule: string;
  training_performance_rule: string;
  recovery_rule: string;
  lab_flags_rule: string;
};

const PHASE_LABELS: Record<string, string> = {
  cut: "Cut",
  maintenance: "Maintenance",
  lean_gain: "Lean gain",
  recomp: "Recomp",
  other: "Other",
};

function emptyPhaseDraft(): PhaseDraft {
  return {
    phase: "maintenance",
    phase_label: "",
    primary_goal: "",
    start_date: "",
    review_date: "",
    review_cadence: "weekly",
    coach_notes: "",
  };
}

function draftFromPlan(plan: PlanProfile | null): PhaseDraft {
  return {
    phase: plan?.phase || "maintenance",
    phase_label: plan?.phase_label || "",
    primary_goal: plan?.primary_goal || "",
    start_date: plan?.start_date || "",
    review_date: plan?.review_date || "",
    review_cadence: plan?.review_cadence || "weekly",
    coach_notes: plan?.coach_notes || "",
  };
}

function emptyNutritionDraft(): NutritionDraft {
  return {
    calories: "",
    protein_g: "",
    macro_notes: "",
    meal_structure: "",
    adherence_target: "",
  };
}

function draftFromNutritionTargets(plan: PlanProfile | null): NutritionDraft {
  const t = asObject(plan?.nutrition_targets);

  return {
    calories: valueToDisplay(t.calories ?? t.target_kcal ?? t.kcal),
    protein_g: valueToDisplay(t.protein_g ?? t.target_protein_g ?? t.protein),
    macro_notes: valueToDisplay(t.macro_notes ?? t.carbs_fat ?? t.macros),
    meal_structure: valueToDisplay(t.meal_structure ?? t.meals ?? t.meal_timing),
    adherence_target: valueToDisplay(t.adherence_target ?? t.adherence),
  };
}

function emptyTrainingDraft(): TrainingDraft {
  return {
    split: "",
    workouts_per_week: "",
    priority_areas: "",
    progression_rule: "",
    recovery_constraints: "",
  };
}

function draftFromTrainingTargets(plan: PlanProfile | null): TrainingDraft {
  const t = asObject(plan?.training_targets);

  return {
    split: valueToDisplay(t.split ?? t.weekly_split),
    workouts_per_week: valueToDisplay(t.workouts_per_week ?? t.frequency),
    priority_areas: valueToDisplay(t.priority_areas ?? t.weak_points),
    progression_rule: valueToDisplay(t.progression_rule ?? t.progression),
    recovery_constraints: valueToDisplay(t.recovery_constraints ?? t.constraints),
  };
}

function emptyBodyStateDraft(): BodyStateDraft {
  return {
    weight_lb: "",
    waist_in: "",
    measurements: "",
    body_fat_percent: "",
    measurement_method: "",
    calipers: "",
    body_scan: "",
  };
}

function draftFromBodyState(plan: PlanProfile | null): BodyStateDraft {
  const b = asObject(plan?.body_state);

  return {
    weight_lb: valueToDisplay(b.weight_lb ?? b.weight ?? b.body_weight),
    waist_in: valueToDisplay(b.waist_in ?? b.waist),
    measurements: valueToDisplay(b.measurements),
    body_fat_percent: valueToDisplay(b.body_fat_percent ?? b.body_composition),
    measurement_method: valueToDisplay(b.measurement_method ?? b.method),
    calipers: valueToDisplay(b.calipers ?? b.caliper_sites),
    body_scan: valueToDisplay(b.body_scan ?? b.scan),
  };
}

function emptyRecoveryDraft(): RecoveryDraft {
  return {
    sleep_hours: "",
    rest_days: "",
    mobility_goal: "",
    fatigue_watch: "",
  };
}

function draftFromRecoveryTargets(plan: PlanProfile | null): RecoveryDraft {
  const r = asObject(plan?.recovery_targets);

  return {
    sleep_hours: valueToDisplay(r.sleep_hours ?? r.sleep_target),
    rest_days: valueToDisplay(r.rest_days ?? r.rest),
    mobility_goal: valueToDisplay(r.mobility_goal ?? r.mobility),
    fatigue_watch: valueToDisplay(r.fatigue_watch ?? r.fatigue),
  };
}

function emptyConditioningActivityDraft(): ConditioningActivityDraft {
  return {
    cardio_target: "",
    preferred_mode: "",
    intensity: "",
    steps_per_day: "",
    wearable_source: "",
  };
}

function draftFromConditioningActivity(plan: PlanProfile | null): ConditioningActivityDraft {
  const c = asObject(plan?.conditioning_targets);
  const a = asObject(plan?.activity_targets);

  return {
    cardio_target: valueToDisplay(c.cardio_target ?? c.cardio_sessions_per_week ?? c.minutes_per_week),
    preferred_mode: valueToDisplay(c.preferred_mode ?? c.mode),
    intensity: valueToDisplay(c.intensity ?? c.zone ?? c.rpe),
    steps_per_day: valueToDisplay(a.steps_per_day ?? a.step_target ?? a.neat),
    wearable_source: valueToDisplay(a.wearable_source ?? a.source),
  };
}

function emptyMonitoringDraft(): MonitoringDraft {
  return {
    summary: "",
    weight_trend_rule: "",
    nutrition_adherence_rule: "",
    training_performance_rule: "",
    recovery_rule: "",
    lab_flags_rule: "",
  };
}

function draftFromMonitoringRules(plan: PlanProfile | null): MonitoringDraft {
  const m = asObject(plan?.monitoring_rules);

  return {
    summary: valueToDisplay(m.summary ?? m.adjustment_rule ?? m.rules),
    weight_trend_rule: valueToDisplay(m.weight_trend_rule ?? m.weight_trend),
    nutrition_adherence_rule: valueToDisplay(m.nutrition_adherence_rule ?? m.nutrition_adherence),
    training_performance_rule: valueToDisplay(m.training_performance_rule ?? m.training_performance),
    recovery_rule: valueToDisplay(m.recovery_rule ?? m.recovery),
    lab_flags_rule: valueToDisplay(m.lab_flags_rule ?? m.lab_flags ?? m.biomarkers),
  };
}

function SectionCard({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-2xl border bg-background p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {eyebrow}
      </div>
      <div className="mt-1 text-lg font-semibold">{title}</div>
      <div className="mt-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function PlanRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-muted/40 py-2 last:border-0">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="max-w-[65%] text-right text-sm">{value}</div>
    </div>
  );
}

function asObject(v: unknown): JsonObject {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObject) : {};
}

function valueToDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (Array.isArray(value)) {
    return value
      .map((item) => valueToDisplay(item))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return "";
}

function readValue(obj: JsonObject, keys: string[], fallback: string): React.ReactNode {
  for (const key of keys) {
    const rendered = valueToDisplay(obj[key]);
    if (rendered) return rendered;
  }

  return <span className="text-muted-foreground">{fallback}</span>;
}

function textValue(value: unknown, fallback: string): React.ReactNode {
  const rendered = valueToDisplay(value);
  if (rendered) return rendered;
  return <span className="text-muted-foreground">{fallback}</span>;
}

function dateRange(plan: PlanProfile | null): React.ReactNode {
  const start = plan?.start_date || "";
  const review = plan?.review_date || "";
  if (start && review) return `${start} → ${review}`;
  if (start) return `Started ${start}`;
  if (review) return `Review ${review}`;
  return <span className="text-muted-foreground">Plan start date and next check-in</span>;
}

function updatedLabel(plan: PlanProfile | null): string {
  if (!plan?.updated_at) return "";
  try {
    return new Date(plan.updated_at).toLocaleString();
  } catch {
    return plan.updated_at;
  }
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function FieldTextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <textarea
        className="min-h-28 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}


export function PlanProfileClient() {
  const [plan, setPlan] = React.useState<PlanProfile | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "unauthorized" | "error">("loading");
  const [error, setError] = React.useState<string>("");

  const [editingPhase, setEditingPhase] = React.useState(false);
  const [savingPhase, setSavingPhase] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState("");
  const [phaseDraft, setPhaseDraft] = React.useState<PhaseDraft>(() => emptyPhaseDraft());

  const [editingNutrition, setEditingNutrition] = React.useState(false);
  const [savingNutrition, setSavingNutrition] = React.useState(false);
  const [nutritionDraft, setNutritionDraft] = React.useState<NutritionDraft>(() => emptyNutritionDraft());

  const [editingTraining, setEditingTraining] = React.useState(false);
  const [savingTraining, setSavingTraining] = React.useState(false);
  const [trainingDraft, setTrainingDraft] = React.useState<TrainingDraft>(() => emptyTrainingDraft());

  const [editingBodyState, setEditingBodyState] = React.useState(false);
  const [savingBodyState, setSavingBodyState] = React.useState(false);
  const [bodyStateDraft, setBodyStateDraft] = React.useState<BodyStateDraft>(() => emptyBodyStateDraft());

  const [editingRecovery, setEditingRecovery] = React.useState(false);
  const [savingRecovery, setSavingRecovery] = React.useState(false);
  const [recoveryDraft, setRecoveryDraft] = React.useState<RecoveryDraft>(() => emptyRecoveryDraft());

  const [editingConditioningActivity, setEditingConditioningActivity] = React.useState(false);
  const [savingConditioningActivity, setSavingConditioningActivity] = React.useState(false);
  const [conditioningActivityDraft, setConditioningActivityDraft] = React.useState<ConditioningActivityDraft>(() => emptyConditioningActivityDraft());

  const [editingMonitoring, setEditingMonitoring] = React.useState(false);
  const [savingMonitoring, setSavingMonitoring] = React.useState(false);
  const [monitoringDraft, setMonitoringDraft] = React.useState<MonitoringDraft>(() => emptyMonitoringDraft());

  React.useEffect(() => {
    let alive = true;

    async function load() {
      setStatus("loading");
      setError("");

      try {
        const r = await authFetch("/api/lifeswitch/plan/profile?create_if_missing=1", {
          cache: "no-store",
        });

        if (r.status === 401) {
          if (alive) {
            setStatus("unauthorized");
            setPlan(null);
          }
          return;
        }

        const text = await r.text();
        const data = text ? JSON.parse(text) : null;

        if (!r.ok) {
          throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
        }

        if (alive) {
          const loaded = data as PlanProfile;
          setPlan(loaded);
          setPhaseDraft(draftFromPlan(loaded));
          setNutritionDraft(draftFromNutritionTargets(loaded));
          setTrainingDraft(draftFromTrainingTargets(loaded));
          setBodyStateDraft(draftFromBodyState(loaded));
          setRecoveryDraft(draftFromRecoveryTargets(loaded));
          setConditioningActivityDraft(draftFromConditioningActivity(loaded));
          setMonitoringDraft(draftFromMonitoringRules(loaded));
          setStatus("ready");
        }
      } catch (e) {
        if (alive) {
          setError(String(e));
          setStatus("error");
        }
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, []);

  async function saveCurrentPhase() {
    setSavingPhase(true);
    setSaveMessage("");
    setError("");

    try {
      const payload = {
        phase: phaseDraft.phase || "maintenance",
        phase_label: phaseDraft.phase_label,
        primary_goal: phaseDraft.primary_goal,
        start_date: phaseDraft.start_date || null,
        review_date: phaseDraft.review_date || null,
        review_cadence: phaseDraft.review_cadence || "weekly",

        body_state: asObject(plan?.body_state),
        nutrition_targets: asObject(plan?.nutrition_targets),
        training_targets: asObject(plan?.training_targets),
        conditioning_targets: asObject(plan?.conditioning_targets),
        activity_targets: asObject(plan?.activity_targets),
        recovery_targets: asObject(plan?.recovery_targets),
        monitoring_rules: asObject(plan?.monitoring_rules),

        coach_notes: phaseDraft.coach_notes,
      };

      const r = await authFetch("/api/lifeswitch/plan/profile/upsert?snapshot_reason=current_phase_editor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const text = await r.text();
      const data = text ? JSON.parse(text) : null;

      if (!r.ok) {
        throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
      }

      const saved = data as PlanProfile;
      setPlan(saved);
      setPhaseDraft(draftFromPlan(saved));
      setNutritionDraft(draftFromNutritionTargets(saved));
      setTrainingDraft(draftFromTrainingTargets(saved));
      setBodyStateDraft(draftFromBodyState(saved));
      setRecoveryDraft(draftFromRecoveryTargets(saved));
      setConditioningActivityDraft(draftFromConditioningActivity(saved));
      setMonitoringDraft(draftFromMonitoringRules(saved));
      setEditingPhase(false);
      setStatus("ready");
      setSaveMessage("Saved current phase.");
    } catch (e) {
      setSaveMessage("");
      setError(String(e));
      setStatus("error");
    } finally {
      setSavingPhase(false);
    }
  }

  async function saveNutritionTargets() {
    setSavingNutrition(true);
    setSaveMessage("");
    setError("");

    try {
      const payload = {
        phase: plan?.phase || "maintenance",
        phase_label: plan?.phase_label || "",
        primary_goal: plan?.primary_goal || "",
        start_date: plan?.start_date || null,
        review_date: plan?.review_date || null,
        review_cadence: plan?.review_cadence || "weekly",

        body_state: asObject(plan?.body_state),
        nutrition_targets: {
          calories: nutritionDraft.calories,
          protein_g: nutritionDraft.protein_g,
          macro_notes: nutritionDraft.macro_notes,
          meal_structure: nutritionDraft.meal_structure,
          adherence_target: nutritionDraft.adherence_target,
        },
        training_targets: asObject(plan?.training_targets),
        conditioning_targets: asObject(plan?.conditioning_targets),
        activity_targets: asObject(plan?.activity_targets),
        recovery_targets: asObject(plan?.recovery_targets),
        monitoring_rules: asObject(plan?.monitoring_rules),

        coach_notes: plan?.coach_notes || "",
      };

      const r = await authFetch("/api/lifeswitch/plan/profile/upsert?snapshot_reason=nutrition_targets_editor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const text = await r.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(text || `HTTP ${r.status}`);
      }

      if (!r.ok) {
        throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
      }

      const saved = data as PlanProfile;
      setPlan(saved);
      setPhaseDraft(draftFromPlan(saved));
      setNutritionDraft(draftFromNutritionTargets(saved));
      setTrainingDraft(draftFromTrainingTargets(saved));
      setBodyStateDraft(draftFromBodyState(saved));
      setRecoveryDraft(draftFromRecoveryTargets(saved));
      setConditioningActivityDraft(draftFromConditioningActivity(saved));
      setMonitoringDraft(draftFromMonitoringRules(saved));
      setEditingNutrition(false);
      setStatus("ready");
      setSaveMessage("Saved nutrition targets.");
    } catch (e) {
      setSaveMessage("");
      setError(String(e));
      setStatus("error");
    } finally {
      setSavingNutrition(false);
    }
  }

  async function saveTrainingTargets() {
    setSavingTraining(true);
    setSaveMessage("");
    setError("");

    try {
      const payload = {
        phase: plan?.phase || "maintenance",
        phase_label: plan?.phase_label || "",
        primary_goal: plan?.primary_goal || "",
        start_date: plan?.start_date || null,
        review_date: plan?.review_date || null,
        review_cadence: plan?.review_cadence || "weekly",

        body_state: asObject(plan?.body_state),
        nutrition_targets: asObject(plan?.nutrition_targets),
        training_targets: {
          split: trainingDraft.split,
          workouts_per_week: trainingDraft.workouts_per_week,
          priority_areas: trainingDraft.priority_areas,
          progression_rule: trainingDraft.progression_rule,
          recovery_constraints: trainingDraft.recovery_constraints,
        },
        conditioning_targets: asObject(plan?.conditioning_targets),
        activity_targets: asObject(plan?.activity_targets),
        recovery_targets: asObject(plan?.recovery_targets),
        monitoring_rules: asObject(plan?.monitoring_rules),

        coach_notes: plan?.coach_notes || "",
      };

      const r = await authFetch("/api/lifeswitch/plan/profile/upsert?snapshot_reason=training_targets_editor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const text = await r.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(text || `HTTP ${r.status}`);
      }

      if (!r.ok) {
        throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
      }

      const saved = data as PlanProfile;
      setPlan(saved);
      setPhaseDraft(draftFromPlan(saved));
      setNutritionDraft(draftFromNutritionTargets(saved));
      setTrainingDraft(draftFromTrainingTargets(saved));
      setBodyStateDraft(draftFromBodyState(saved));
      setRecoveryDraft(draftFromRecoveryTargets(saved));
      setConditioningActivityDraft(draftFromConditioningActivity(saved));
      setMonitoringDraft(draftFromMonitoringRules(saved));
      setEditingTraining(false);
      setStatus("ready");
      setSaveMessage("Saved training targets.");
    } catch (e) {
      setSaveMessage("");
      setError(String(e));
      setStatus("error");
    } finally {
      setSavingTraining(false);
    }
  }

  async function saveBodyState() {
    setSavingBodyState(true);
    setSaveMessage("");
    setError("");

    try {
      const payload = {
        phase: plan?.phase || "maintenance",
        phase_label: plan?.phase_label || "",
        primary_goal: plan?.primary_goal || "",
        start_date: plan?.start_date || null,
        review_date: plan?.review_date || null,
        review_cadence: plan?.review_cadence || "weekly",

        body_state: {
          weight_lb: bodyStateDraft.weight_lb,
          waist_in: bodyStateDraft.waist_in,
          measurements: bodyStateDraft.measurements,
          body_fat_percent: bodyStateDraft.body_fat_percent,
          measurement_method: bodyStateDraft.measurement_method,
          calipers: bodyStateDraft.calipers,
          body_scan: bodyStateDraft.body_scan,
        },
        nutrition_targets: asObject(plan?.nutrition_targets),
        training_targets: asObject(plan?.training_targets),
        conditioning_targets: asObject(plan?.conditioning_targets),
        activity_targets: asObject(plan?.activity_targets),
        recovery_targets: asObject(plan?.recovery_targets),
        monitoring_rules: asObject(plan?.monitoring_rules),

        coach_notes: plan?.coach_notes || "",
      };

      const r = await authFetch("/api/lifeswitch/plan/profile/upsert?snapshot_reason=body_state_editor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const text = await r.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(text || `HTTP ${r.status}`);
      }

      if (!r.ok) {
        throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
      }

      const saved = data as PlanProfile;
      setPlan(saved);
      setPhaseDraft(draftFromPlan(saved));
      setNutritionDraft(draftFromNutritionTargets(saved));
      setTrainingDraft(draftFromTrainingTargets(saved));
      setBodyStateDraft(draftFromBodyState(saved));
      setRecoveryDraft(draftFromRecoveryTargets(saved));
      setConditioningActivityDraft(draftFromConditioningActivity(saved));
      setMonitoringDraft(draftFromMonitoringRules(saved));
      setEditingBodyState(false);
      setStatus("ready");
      setSaveMessage("Saved body state.");
    } catch (e) {
      setSaveMessage("");
      setError(String(e));
      setStatus("error");
    } finally {
      setSavingBodyState(false);
    }
  }

  async function saveRecoveryTargets() {
    setSavingRecovery(true);
    setSaveMessage("");
    setError("");

    try {
      const payload = {
        phase: plan?.phase || "maintenance",
        phase_label: plan?.phase_label || "",
        primary_goal: plan?.primary_goal || "",
        start_date: plan?.start_date || null,
        review_date: plan?.review_date || null,
        review_cadence: plan?.review_cadence || "weekly",

        body_state: asObject(plan?.body_state),
        nutrition_targets: asObject(plan?.nutrition_targets),
        training_targets: asObject(plan?.training_targets),
        conditioning_targets: asObject(plan?.conditioning_targets),
        activity_targets: asObject(plan?.activity_targets),
        recovery_targets: {
          sleep_hours: recoveryDraft.sleep_hours,
          rest_days: recoveryDraft.rest_days,
          mobility_goal: recoveryDraft.mobility_goal,
          fatigue_watch: recoveryDraft.fatigue_watch,
        },
        monitoring_rules: asObject(plan?.monitoring_rules),

        coach_notes: plan?.coach_notes || "",
      };

      const r = await authFetch("/api/lifeswitch/plan/profile/upsert?snapshot_reason=recovery_targets_editor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const text = await r.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(text || `HTTP ${r.status}`);
      }

      if (!r.ok) {
        throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
      }

      const saved = data as PlanProfile;
      setPlan(saved);
      setPhaseDraft(draftFromPlan(saved));
      setNutritionDraft(draftFromNutritionTargets(saved));
      setTrainingDraft(draftFromTrainingTargets(saved));
      setBodyStateDraft(draftFromBodyState(saved));
      setRecoveryDraft(draftFromRecoveryTargets(saved));
      setConditioningActivityDraft(draftFromConditioningActivity(saved));
      setMonitoringDraft(draftFromMonitoringRules(saved));
      setEditingRecovery(false);
      setStatus("ready");
      setSaveMessage("Saved recovery targets.");
    } catch (e) {
      setSaveMessage("");
      setError(String(e));
      setStatus("error");
    } finally {
      setSavingRecovery(false);
    }
  }

  async function saveConditioningActivity() {
    setSavingConditioningActivity(true);
    setSaveMessage("");
    setError("");

    try {
      const payload = {
        phase: plan?.phase || "maintenance",
        phase_label: plan?.phase_label || "",
        primary_goal: plan?.primary_goal || "",
        start_date: plan?.start_date || null,
        review_date: plan?.review_date || null,
        review_cadence: plan?.review_cadence || "weekly",

        body_state: asObject(plan?.body_state),
        nutrition_targets: asObject(plan?.nutrition_targets),
        training_targets: asObject(plan?.training_targets),
        conditioning_targets: {
          cardio_target: conditioningActivityDraft.cardio_target,
          preferred_mode: conditioningActivityDraft.preferred_mode,
          intensity: conditioningActivityDraft.intensity,
        },
        activity_targets: {
          steps_per_day: conditioningActivityDraft.steps_per_day,
          wearable_source: conditioningActivityDraft.wearable_source,
        },
        recovery_targets: asObject(plan?.recovery_targets),
        monitoring_rules: asObject(plan?.monitoring_rules),

        coach_notes: plan?.coach_notes || "",
      };

      const r = await authFetch("/api/lifeswitch/plan/profile/upsert?snapshot_reason=conditioning_activity_editor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const text = await r.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(text || `HTTP ${r.status}`);
      }

      if (!r.ok) {
        throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
      }

      const saved = data as PlanProfile;
      setPlan(saved);
      setPhaseDraft(draftFromPlan(saved));
      setNutritionDraft(draftFromNutritionTargets(saved));
      setTrainingDraft(draftFromTrainingTargets(saved));
      setBodyStateDraft(draftFromBodyState(saved));
      setRecoveryDraft(draftFromRecoveryTargets(saved));
      setConditioningActivityDraft(draftFromConditioningActivity(saved));
      setMonitoringDraft(draftFromMonitoringRules(saved));
      setEditingConditioningActivity(false);
      setStatus("ready");
      setSaveMessage("Saved conditioning and activity targets.");
    } catch (e) {
      setSaveMessage("");
      setError(String(e));
      setStatus("error");
    } finally {
      setSavingConditioningActivity(false);
    }
  }

  async function saveMonitoringRules() {
    setSavingMonitoring(true);
    setSaveMessage("");
    setError("");

    try {
      const payload = {
        phase: plan?.phase || "maintenance",
        phase_label: plan?.phase_label || "",
        primary_goal: plan?.primary_goal || "",
        start_date: plan?.start_date || null,
        review_date: plan?.review_date || null,
        review_cadence: plan?.review_cadence || "weekly",

        body_state: asObject(plan?.body_state),
        nutrition_targets: asObject(plan?.nutrition_targets),
        training_targets: asObject(plan?.training_targets),
        conditioning_targets: asObject(plan?.conditioning_targets),
        activity_targets: asObject(plan?.activity_targets),
        recovery_targets: asObject(plan?.recovery_targets),
        monitoring_rules: {
          summary: monitoringDraft.summary,
          weight_trend_rule: monitoringDraft.weight_trend_rule,
          nutrition_adherence_rule: monitoringDraft.nutrition_adherence_rule,
          training_performance_rule: monitoringDraft.training_performance_rule,
          recovery_rule: monitoringDraft.recovery_rule,
          lab_flags_rule: monitoringDraft.lab_flags_rule,
        },

        coach_notes: plan?.coach_notes || "",
      };

      const r = await authFetch("/api/lifeswitch/plan/profile/upsert?snapshot_reason=monitoring_rules_editor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const text = await r.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(text || `HTTP ${r.status}`);
      }

      if (!r.ok) {
        throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
      }

      const saved = data as PlanProfile;
      setPlan(saved);
      setPhaseDraft(draftFromPlan(saved));
      setNutritionDraft(draftFromNutritionTargets(saved));
      setTrainingDraft(draftFromTrainingTargets(saved));
      setBodyStateDraft(draftFromBodyState(saved));
      setRecoveryDraft(draftFromRecoveryTargets(saved));
      setConditioningActivityDraft(draftFromConditioningActivity(saved));
      setMonitoringDraft(draftFromMonitoringRules(saved));
      setEditingMonitoring(false);
      setStatus("ready");
      setSaveMessage("Saved monitoring rules.");
    } catch (e) {
      setSaveMessage("");
      setError(String(e));
      setStatus("error");
    } finally {
      setSavingMonitoring(false);
    }
  }

  const bodyState = asObject(plan?.body_state);
  const nutritionTargets = asObject(plan?.nutrition_targets);
  const trainingTargets = asObject(plan?.training_targets);
  const conditioningTargets = asObject(plan?.conditioning_targets);
  const activityTargets = asObject(plan?.activity_targets);
  const recoveryTargets = asObject(plan?.recovery_targets);
  const monitoringRules = asObject(plan?.monitoring_rules);

  const phase = plan?.phase ? PHASE_LABELS[plan.phase] || plan.phase : "Maintenance";
  const phaseLabel = plan?.phase_label?.trim();

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4 pb-24 md:p-6">
      <div className="rounded-2xl border bg-background p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          LifeSwitch
        </div>
        <h1 className="mt-1 text-2xl font-semibold">Physique Plan</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          One integrated plan for body composition, nutrition, strength training,
          conditioning, daily activity, recovery, monitoring, and weekly adjustment.
        </p>

        <div className="mt-3 text-xs text-muted-foreground">
          {status === "loading" ? "Loading current plan…" : null}
          {status === "ready" && plan ? `Loaded from backend · Updated ${updatedLabel(plan)}` : null}
          {status === "unauthorized" ? "Sign in required to load your saved LifeSwitch plan." : null}
          {status === "error" ? `Could not load plan: ${error}` : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <a href="#current-phase" className="rounded-full border px-3 py-1 hover:bg-muted/40">Phase</a>
          <a href="#body-state" className="rounded-full border px-3 py-1 hover:bg-muted/40">Body State</a>
          <a href="#biomarkers-labs" className="rounded-full border px-3 py-1 hover:bg-muted/40">Labs</a>
          <a href="#nutrition-targets" className="rounded-full border px-3 py-1 hover:bg-muted/40">Nutrition</a>
          <a href="#training-targets" className="rounded-full border px-3 py-1 hover:bg-muted/40">Training</a>
          <a href="#conditioning-targets" className="rounded-full border px-3 py-1 hover:bg-muted/40">Conditioning</a>
          <a href="#recovery-targets" className="rounded-full border px-3 py-1 hover:bg-muted/40">Recovery</a>
          <a href="#monitoring-rules" className="rounded-full border px-3 py-1 hover:bg-muted/40">Adjustments</a>
          <a href="#coach-notes" className="rounded-full border px-3 py-1 hover:bg-muted/40">Notes</a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <SectionCard id="current-phase" eyebrow="Current intervention" title="Current Phase">
            {editingPhase ? (
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldSelect
                    label="Phase"
                    value={phaseDraft.phase}
                    onChange={(value) => setPhaseDraft((d) => ({ ...d, phase: value }))}
                  >
                    <option value="cut">Cut</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="lean_gain">Lean gain</option>
                    <option value="recomp">Recomp</option>
                    <option value="other">Other</option>
                  </FieldSelect>

                  <FieldInput
                    label="Phase label"
                    value={phaseDraft.phase_label}
                    placeholder="Optional short description"
                    onChange={(value) => setPhaseDraft((d) => ({ ...d, phase_label: value }))}
                  />

                  <FieldInput
                    label="Start date"
                    type="date"
                    value={phaseDraft.start_date}
                    onChange={(value) => setPhaseDraft((d) => ({ ...d, start_date: value }))}
                  />

                  <FieldInput
                    label="Review date"
                    type="date"
                    value={phaseDraft.review_date}
                    onChange={(value) => setPhaseDraft((d) => ({ ...d, review_date: value }))}
                  />

                  <FieldInput
                    label="Review cadence"
                    value={phaseDraft.review_cadence}
                    placeholder="weekly"
                    onChange={(value) => setPhaseDraft((d) => ({ ...d, review_cadence: value }))}
                  />
                </div>

                <FieldTextArea
                  label="Primary goal"
                  value={phaseDraft.primary_goal}
                  placeholder="What is this plan trying to accomplish?"
                  onChange={(value) => setPhaseDraft((d) => ({ ...d, primary_goal: value }))}
                />

                <FieldTextArea
                  label="Coach notes"
                  value={phaseDraft.coach_notes}
                  placeholder="Weekly focus, risks, adjustment notes."
                  onChange={(value) => setPhaseDraft((d) => ({ ...d, coach_notes: value }))}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => void saveCurrentPhase()}
                    disabled={savingPhase || status === "unauthorized"}
                  >
                    {savingPhase ? "Saving…" : "Save current phase"}
                  </button>

                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40"
                    onClick={() => {
                      setPhaseDraft(draftFromPlan(plan));
                      setEditingPhase(false);
                      setSaveMessage("");
                    }}
                    disabled={savingPhase}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-1">
                <PlanRow label="Phase" value={phaseLabel ? `${phase} · ${phaseLabel}` : phase} />
                <PlanRow label="Primary goal" value={textValue(plan?.primary_goal, "Body-composition outcome and performance priority")} />
                <PlanRow label="Start / review dates" value={dateRange(plan)} />
                <PlanRow label="Review cadence" value={textValue(plan?.review_cadence, "Weekly")} />
                <div className="pt-3">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => {
                      setPhaseDraft(draftFromPlan(plan));
                      setEditingPhase(true);
                      setSaveMessage("");
                    }}
                    disabled={status === "loading" || status === "unauthorized"}
                  >
                    Edit current phase
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard id="nutrition-targets" eyebrow="Nutrition prescription" title="Nutrition Targets">
            {editingNutrition ? (
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldInput
                    label="Calories"
                    value={nutritionDraft.calories}
                    placeholder="Daily target or range"
                    onChange={(value) => setNutritionDraft((d) => ({ ...d, calories: value }))}
                  />

                  <FieldInput
                    label="Protein"
                    value={nutritionDraft.protein_g}
                    placeholder="Daily grams or minimum threshold"
                    onChange={(value) => setNutritionDraft((d) => ({ ...d, protein_g: value }))}
                  />

                  <FieldInput
                    label="Carbs / Fat"
                    value={nutritionDraft.macro_notes}
                    placeholder="Macro ranges or flexible targets"
                    onChange={(value) => setNutritionDraft((d) => ({ ...d, macro_notes: value }))}
                  />

                  <FieldInput
                    label="Adherence target"
                    value={nutritionDraft.adherence_target}
                    placeholder="What counts as compliant enough?"
                    onChange={(value) => setNutritionDraft((d) => ({ ...d, adherence_target: value }))}
                  />
                </div>

                <FieldTextArea
                  label="Meal structure"
                  value={nutritionDraft.meal_structure}
                  placeholder="Meal timing, meal count, repeat meals, pre/post-workout notes."
                  onChange={(value) => setNutritionDraft((d) => ({ ...d, meal_structure: value }))}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => void saveNutritionTargets()}
                    disabled={savingNutrition || status === "unauthorized"}
                  >
                    {savingNutrition ? "Saving…" : "Save nutrition targets"}
                  </button>

                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40"
                    onClick={() => {
                      setNutritionDraft(draftFromNutritionTargets(plan));
                      setEditingNutrition(false);
                      setSaveMessage("");
                    }}
                    disabled={savingNutrition}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-1">
                <PlanRow label="Calories" value={readValue(nutritionTargets, ["calories", "target_kcal", "kcal"], "Daily target or range")} />
                <PlanRow label="Protein" value={readValue(nutritionTargets, ["protein_g", "target_protein_g", "protein"], "Daily grams and minimum threshold")} />
                <PlanRow label="Carbs / Fat" value={readValue(nutritionTargets, ["macro_notes", "carbs_fat", "macros"], "Macro ranges or flexible targets")} />
                <PlanRow label="Meal structure" value={readValue(nutritionTargets, ["meal_structure", "meals", "meal_timing"], "Meal timing, meal count, repeat meals, pre/post-workout notes")} />
                <PlanRow label="Adherence target" value={readValue(nutritionTargets, ["adherence_target", "adherence"], "What counts as compliant enough this week")} />
                <div className="pt-2 text-xs">
                  Related:{" "}
                  <Link href="/lifeswitch/nutrition/meals" className="underline">Meals</Link>
                  {" · "}
                  <Link href="/lifeswitch/nutrition/meal-plans" className="underline">Meal Plans</Link>
                  {" · "}
                  <Link href="/lifeswitch/nutrition/capture" className="underline">Nutrition Capture</Link>
                </div>
                <div className="pt-3">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => {
                      setNutritionDraft(draftFromNutritionTargets(plan));
                      setEditingNutrition(true);
                      setSaveMessage("");
                    }}
                    disabled={status === "loading" || status === "unauthorized"}
                  >
                    Edit nutrition targets
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard id="training-targets" eyebrow="Strength prescription" title="Strength Training Targets">
            {editingTraining ? (
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldInput
                    label="Split"
                    value={trainingDraft.split}
                    placeholder="Current weekly split and training days"
                    onChange={(value) => setTrainingDraft((d) => ({ ...d, split: value }))}
                  />

                  <FieldInput
                    label="Frequency"
                    value={trainingDraft.workouts_per_week}
                    placeholder="Workouts per week and expected duration"
                    onChange={(value) => setTrainingDraft((d) => ({ ...d, workouts_per_week: value }))}
                  />
                </div>

                <FieldTextArea
                  label="Priority areas"
                  value={trainingDraft.priority_areas}
                  placeholder="Weak points, priority lifts, muscles, or movement patterns."
                  onChange={(value) => setTrainingDraft((d) => ({ ...d, priority_areas: value }))}
                />

                <FieldTextArea
                  label="Progression rule"
                  value={trainingDraft.progression_rule}
                  placeholder="How load, reps, sets, or effort should change."
                  onChange={(value) => setTrainingDraft((d) => ({ ...d, progression_rule: value }))}
                />

                <FieldTextArea
                  label="Recovery constraints"
                  value={trainingDraft.recovery_constraints}
                  placeholder="Pain, surgery limits, fatigue, soreness, deload triggers."
                  onChange={(value) => setTrainingDraft((d) => ({ ...d, recovery_constraints: value }))}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => void saveTrainingTargets()}
                    disabled={savingTraining || status === "unauthorized"}
                  >
                    {savingTraining ? "Saving…" : "Save training targets"}
                  </button>

                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40"
                    onClick={() => {
                      setTrainingDraft(draftFromTrainingTargets(plan));
                      setEditingTraining(false);
                      setSaveMessage("");
                    }}
                    disabled={savingTraining}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-1">
                <PlanRow label="Split" value={readValue(trainingTargets, ["split", "weekly_split"], "Current weekly split and training days")} />
                <PlanRow label="Frequency" value={readValue(trainingTargets, ["workouts_per_week", "frequency"], "Workouts per week and expected duration")} />
                <PlanRow label="Priority areas" value={readValue(trainingTargets, ["priority_areas", "weak_points"], "Weak points, priority lifts, muscles, or movement patterns")} />
                <PlanRow label="Progression rule" value={readValue(trainingTargets, ["progression_rule", "progression"], "How load, reps, sets, or effort should change")} />
                <PlanRow label="Recovery constraints" value={readValue(trainingTargets, ["recovery_constraints", "constraints"], "Pain, surgery limits, fatigue, soreness, deload triggers")} />
                <div className="pt-2 text-xs">
                  Related:{" "}
                  <Link href="/lifeswitch/training/workouts" className="underline">Strength Workouts</Link>
                  {" · "}
                  <Link href="/lifeswitch/training/capture" className="underline">Training Capture</Link>
                  {" · "}
                  <Link href="/lifeswitch/training/calendar" className="underline">Training Log</Link>
                </div>
                <div className="pt-3">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => {
                      setTrainingDraft(draftFromTrainingTargets(plan));
                      setEditingTraining(true);
                      setSaveMessage("");
                    }}
                    disabled={status === "loading" || status === "unauthorized"}
                  >
                    Edit training targets
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard id="conditioning-targets" eyebrow="Cardio / conditioning" title="Conditioning and Daily Activity Targets">
            {editingConditioningActivity ? (
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldInput
                    label="Cardio target"
                    value={conditioningActivityDraft.cardio_target}
                    placeholder="None / optional / sessions per week / minutes per week"
                    onChange={(value) => setConditioningActivityDraft((d) => ({ ...d, cardio_target: value }))}
                  />

                  <FieldInput
                    label="Preferred mode"
                    value={conditioningActivityDraft.preferred_mode}
                    placeholder="Incline walk, treadmill, bike, intervals, ropes, sled"
                    onChange={(value) => setConditioningActivityDraft((d) => ({ ...d, preferred_mode: value }))}
                  />

                  <FieldInput
                    label="Intensity"
                    value={conditioningActivityDraft.intensity}
                    placeholder="Zone 2, intervals, RPE, heart-rate target"
                    onChange={(value) => setConditioningActivityDraft((d) => ({ ...d, intensity: value }))}
                  />

                  <FieldInput
                    label="Steps / NEAT"
                    value={conditioningActivityDraft.steps_per_day}
                    placeholder="Daily or weekly step target"
                    onChange={(value) => setConditioningActivityDraft((d) => ({ ...d, steps_per_day: value }))}
                  />

                  <FieldInput
                    label="Wearable source"
                    value={conditioningActivityDraft.wearable_source}
                    placeholder="Apple Health, Garmin, Fitbit, manual"
                    onChange={(value) => setConditioningActivityDraft((d) => ({ ...d, wearable_source: value }))}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => void saveConditioningActivity()}
                    disabled={savingConditioningActivity || status === "unauthorized"}
                  >
                    {savingConditioningActivity ? "Saving…" : "Save conditioning / activity"}
                  </button>

                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40"
                    onClick={() => {
                      setConditioningActivityDraft(draftFromConditioningActivity(plan));
                      setEditingConditioningActivity(false);
                      setSaveMessage("");
                    }}
                    disabled={savingConditioningActivity}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-1">
                <PlanRow label="Cardio target" value={readValue(conditioningTargets, ["cardio_target", "cardio_sessions_per_week", "minutes_per_week"], "None / optional / sessions per week / minutes per week")} />
                <PlanRow label="Preferred mode" value={readValue(conditioningTargets, ["preferred_mode", "mode"], "Incline walk, treadmill, bike, intervals, ropes, sled, outdoor walk/run")} />
                <PlanRow label="Intensity" value={readValue(conditioningTargets, ["intensity", "zone", "rpe"], "Zone 2, intervals, RPE, heart-rate target, or simple duration target")} />
                <PlanRow label="Steps / NEAT" value={readValue(activityTargets, ["steps_per_day", "step_target", "neat"], "Daily or weekly step target and general movement goal")} />
                <PlanRow label="Wearables" value={readValue(activityTargets, ["wearable_source", "source"], "Future source for steps, calories, heart rate, HRV, sleep, zone minutes")} />
                <div className="pt-3">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => {
                      setConditioningActivityDraft(draftFromConditioningActivity(plan));
                      setEditingConditioningActivity(true);
                      setSaveMessage("");
                    }}
                    disabled={status === "loading" || status === "unauthorized"}
                  >
                    Edit conditioning / activity
                  </button>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-4">
          <SectionCard id="body-state" eyebrow="Dependent variables" title="Current Body State">
            {editingBodyState ? (
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldInput
                    label="Weight"
                    value={bodyStateDraft.weight_lb}
                    placeholder="Current body weight / trend"
                    onChange={(value) => setBodyStateDraft((d) => ({ ...d, weight_lb: value }))}
                  />

                  <FieldInput
                    label="Waist"
                    value={bodyStateDraft.waist_in}
                    placeholder="Waist measurement"
                    onChange={(value) => setBodyStateDraft((d) => ({ ...d, waist_in: value }))}
                  />

                  <FieldInput
                    label="Body fat %"
                    value={bodyStateDraft.body_fat_percent}
                    placeholder="Estimate or range"
                    onChange={(value) => setBodyStateDraft((d) => ({ ...d, body_fat_percent: value }))}
                  />

                  <FieldInput
                    label="Method"
                    value={bodyStateDraft.measurement_method}
                    placeholder="Scale, calipers, scan, manual"
                    onChange={(value) => setBodyStateDraft((d) => ({ ...d, measurement_method: value }))}
                  />
                </div>

                <FieldTextArea
                  label="Measurements"
                  value={bodyStateDraft.measurements}
                  placeholder="Waist, chest, arms, thighs, hips, calves."
                  onChange={(value) => setBodyStateDraft((d) => ({ ...d, measurements: value }))}
                />

                <FieldTextArea
                  label="Calipers"
                  value={bodyStateDraft.calipers}
                  placeholder="Caliper sites, formula, or notes."
                  onChange={(value) => setBodyStateDraft((d) => ({ ...d, calipers: value }))}
                />

                <FieldTextArea
                  label="Body scan"
                  value={bodyStateDraft.body_scan}
                  placeholder="DEXA / InBody / 3D scan details or future placeholder."
                  onChange={(value) => setBodyStateDraft((d) => ({ ...d, body_scan: value }))}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => void saveBodyState()}
                    disabled={savingBodyState || status === "unauthorized"}
                  >
                    {savingBodyState ? "Saving…" : "Save body state"}
                  </button>

                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40"
                    onClick={() => {
                      setBodyStateDraft(draftFromBodyState(plan));
                      setEditingBodyState(false);
                      setSaveMessage("");
                    }}
                    disabled={savingBodyState}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-1">
                <PlanRow label="Weight" value={readValue(bodyState, ["weight_lb", "weight", "body_weight"], "Current body weight and trend")} />
                <PlanRow label="Measurements" value={readValue(bodyState, ["measurements", "waist_in", "waist"], "Waist, chest, arms, thighs, hips, calves")} />
                <PlanRow label="Body composition" value={readValue(bodyState, ["body_fat_percent", "body_composition"], "Estimate method and confidence")} />
                <PlanRow label="Calipers" value={readValue(bodyState, ["calipers", "caliper_sites"], "Site measurements and formula later")} />
                <PlanRow label="Body scan" value={readValue(bodyState, ["body_scan", "scan"], "DEXA / InBody / 3D scan placeholder")} />
                <div className="pt-3">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => {
                      setBodyStateDraft(draftFromBodyState(plan));
                      setEditingBodyState(true);
                      setSaveMessage("");
                    }}
                    disabled={status === "loading" || status === "unauthorized"}
                  >
                    Edit body state
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard id="biomarkers-labs" eyebrow="Biomarkers / labs" title="Blood Work and Health Markers">
            <div className="grid gap-2">
              <div className="text-sm text-muted-foreground">
                Future structured lab tracking should live here. Labs can inform nutrition,
                recovery, training tolerance, cardio/activity decisions, and clinician review.
              </div>

              <div className="grid gap-1 border-t border-muted/40 pt-2">
                <PlanRow label="Lab cadence" value="Usually every 3–6 months with functional medicine specialist" />
                <PlanRow label="CBC" value="Hematocrit, hemoglobin, RBC, WBC, platelets" />
                <PlanRow label="Metabolic" value="Glucose, A1c, lipids, liver enzymes, kidney markers" />
                <PlanRow label="Hormones" value="Testosterone, free testosterone if available, estradiol" />
                <PlanRow label="Other flags" value="PSA, B12, homocysteine, inflammatory or nutrient markers" />
                <PlanRow label="Plan rule" value="Use labs as context; review concerning markers with clinician before changing medical variables." />
              </div>
            </div>
          </SectionCard>

          <SectionCard id="recovery-targets" eyebrow="Recovery prescription" title="Sleep and Recovery">
            {editingRecovery ? (
              <div className="grid gap-3">
                <FieldInput
                  label="Sleep target"
                  value={recoveryDraft.sleep_hours}
                  placeholder="Hours, consistency, wakeups, quality"
                  onChange={(value) => setRecoveryDraft((d) => ({ ...d, sleep_hours: value }))}
                />

                <FieldInput
                  label="Rest days"
                  value={recoveryDraft.rest_days}
                  placeholder="Planned rest or low-stress days"
                  onChange={(value) => setRecoveryDraft((d) => ({ ...d, rest_days: value }))}
                />

                <FieldTextArea
                  label="Mobility"
                  value={recoveryDraft.mobility_goal}
                  placeholder="Flexibility, stretching, rehab, or movement-prep goal."
                  onChange={(value) => setRecoveryDraft((d) => ({ ...d, mobility_goal: value }))}
                />

                <FieldTextArea
                  label="Fatigue watch"
                  value={recoveryDraft.fatigue_watch}
                  placeholder="Soreness, joint pain, motivation, performance drop."
                  onChange={(value) => setRecoveryDraft((d) => ({ ...d, fatigue_watch: value }))}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => void saveRecoveryTargets()}
                    disabled={savingRecovery || status === "unauthorized"}
                  >
                    {savingRecovery ? "Saving…" : "Save recovery targets"}
                  </button>

                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40"
                    onClick={() => {
                      setRecoveryDraft(draftFromRecoveryTargets(plan));
                      setEditingRecovery(false);
                      setSaveMessage("");
                    }}
                    disabled={savingRecovery}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-1">
                <PlanRow label="Sleep target" value={readValue(recoveryTargets, ["sleep_hours", "sleep_target"], "Hours, consistency, wakeups, and quality")} />
                <PlanRow label="Rest days" value={readValue(recoveryTargets, ["rest_days", "rest"], "Planned rest or low-stress activity days")} />
                <PlanRow label="Mobility" value={readValue(recoveryTargets, ["mobility_goal", "mobility"], "Flexibility, stretching, rehab, or movement-prep goal")} />
                <PlanRow label="Fatigue watch" value={readValue(recoveryTargets, ["fatigue_watch", "fatigue"], "Soreness, joint pain, motivation, performance drop")} />
                <div className="pt-3">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => {
                      setRecoveryDraft(draftFromRecoveryTargets(plan));
                      setEditingRecovery(true);
                      setSaveMessage("");
                    }}
                    disabled={status === "loading" || status === "unauthorized"}
                  >
                    Edit recovery targets
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard id="monitoring-rules" eyebrow="Adjustment logic" title="Monitoring and Adjustment Rules">
            {editingMonitoring ? (
              <div className="grid gap-3">
                <FieldTextArea
                  label="Summary"
                  value={monitoringDraft.summary}
                  placeholder="Overall rule for when the plan should change."
                  onChange={(value) => setMonitoringDraft((d) => ({ ...d, summary: value }))}
                />

                <FieldTextArea
                  label="Weight trend rule"
                  value={monitoringDraft.weight_trend_rule}
                  placeholder="What weight trend is expected, and when should calories/activity change?"
                  onChange={(value) => setMonitoringDraft((d) => ({ ...d, weight_trend_rule: value }))}
                />

                <FieldTextArea
                  label="Nutrition adherence rule"
                  value={monitoringDraft.nutrition_adherence_rule}
                  placeholder="How many days/week must calories and protein be hit before changing the plan?"
                  onChange={(value) => setMonitoringDraft((d) => ({ ...d, nutrition_adherence_rule: value }))}
                />

                <FieldTextArea
                  label="Training performance rule"
                  value={monitoringDraft.training_performance_rule}
                  placeholder="How should strength, volume, pain, or performance affect the plan?"
                  onChange={(value) => setMonitoringDraft((d) => ({ ...d, training_performance_rule: value }))}
                />

                <FieldTextArea
                  label="Recovery rule"
                  value={monitoringDraft.recovery_rule}
                  placeholder="How should sleep, fatigue, soreness, and joint pain affect the plan?"
                  onChange={(value) => setMonitoringDraft((d) => ({ ...d, recovery_rule: value }))}
                />

                <FieldTextArea
                  label="Lab / biomarker flags"
                  value={monitoringDraft.lab_flags_rule}
                  placeholder="Future: markers that should prompt review with clinician or plan caution."
                  onChange={(value) => setMonitoringDraft((d) => ({ ...d, lab_flags_rule: value }))}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => void saveMonitoringRules()}
                    disabled={savingMonitoring || status === "unauthorized"}
                  >
                    {savingMonitoring ? "Saving…" : "Save monitoring rules"}
                  </button>

                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40"
                    onClick={() => {
                      setMonitoringDraft(draftFromMonitoringRules(plan));
                      setEditingMonitoring(false);
                      setSaveMessage("");
                    }}
                    disabled={savingMonitoring}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <div>
                  {readValue(
                    monitoringRules,
                    ["summary", "adjustment_rule", "rules"],
                    "Define what changes the plan: weight trend, waist change, training performance, adherence, hunger, sleep, fatigue, and recovery."
                  )}
                </div>
                <div className="grid gap-1 border-t border-muted/40 pt-2">
                  <PlanRow label="Weight trend" value={readValue(monitoringRules, ["weight_trend_rule", "weight_trend"], "Expected body-weight trend and adjustment trigger")} />
                  <PlanRow label="Nutrition" value={readValue(monitoringRules, ["nutrition_adherence_rule", "nutrition_adherence"], "Adherence threshold before changing targets")} />
                  <PlanRow label="Training" value={readValue(monitoringRules, ["training_performance_rule", "training_performance"], "Performance/pain rule for training changes")} />
                  <PlanRow label="Recovery" value={readValue(monitoringRules, ["recovery_rule", "recovery"], "Sleep/fatigue/soreness rule")} />
                  <PlanRow label="Labs" value={readValue(monitoringRules, ["lab_flags_rule", "lab_flags", "biomarkers"], "Future clinician/lab review triggers")} />
                </div>
                <div>This is the bridge from plan → capture/log → analysis.</div>
                <div className="pt-3">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
                    onClick={() => {
                      setMonitoringDraft(draftFromMonitoringRules(plan));
                      setEditingMonitoring(true);
                      setSaveMessage("");
                    }}
                    disabled={status === "loading" || status === "unauthorized"}
                  >
                    Edit monitoring rules
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard id="coach-notes" eyebrow="Weekly frame" title="Coach Notes">
            <div className="grid gap-2">
              {plan?.coach_notes?.trim() ? (
                <div className="whitespace-pre-wrap text-foreground">{plan.coach_notes}</div>
              ) : (
                <>
                  <div>What is the plan trying to accomplish this week?</div>
                  <div>What are the risks?</div>
                  <div>What should be adjusted next if the trend is wrong?</div>
                </>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
