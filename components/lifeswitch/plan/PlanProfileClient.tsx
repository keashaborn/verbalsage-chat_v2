"use client";

import * as React from "react";
import Link from "next/link";

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

const PHASE_LABELS: Record<string, string> = {
  cut: "Cut",
  maintenance: "Maintenance",
  lean_gain: "Lean gain",
  recomp: "Recomp",
  other: "Other",
};

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

function readValue(obj: JsonObject, keys: string[], fallback: string): React.ReactNode {
  for (const key of keys) {
    const v = obj[key];

    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (Array.isArray(v) && v.length) return v.join(", ");
  }

  return <span className="text-muted-foreground">{fallback}</span>;
}

function textValue(value: unknown, fallback: string): React.ReactNode {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
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

export function PlanProfileClient() {
  const [plan, setPlan] = React.useState<PlanProfile | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "unauthorized" | "error">("loading");
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    let alive = true;

    async function load() {
      setStatus("loading");
      setError("");

      try {
        const r = await fetch("/api/lifeswitch/plan/profile?create_if_missing=1", {
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
          setPlan(data as PlanProfile);
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
            <div className="grid gap-1">
              <PlanRow label="Phase" value={phaseLabel ? `${phase} · ${phaseLabel}` : phase} />
              <PlanRow label="Primary goal" value={textValue(plan?.primary_goal, "Body-composition outcome and performance priority")} />
              <PlanRow label="Start / review dates" value={dateRange(plan)} />
              <PlanRow label="Review cadence" value={textValue(plan?.review_cadence, "Weekly")} />
            </div>
          </SectionCard>

          <SectionCard id="nutrition-targets" eyebrow="Nutrition prescription" title="Nutrition Targets">
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
            </div>
          </SectionCard>

          <SectionCard id="training-targets" eyebrow="Strength prescription" title="Strength Training Targets">
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
            </div>
          </SectionCard>

          <SectionCard id="conditioning-targets" eyebrow="Cardio / conditioning" title="Conditioning and Daily Activity Targets">
            <div className="grid gap-1">
              <PlanRow label="Cardio target" value={readValue(conditioningTargets, ["cardio_sessions_per_week", "cardio_target"], "None / optional / sessions per week / minutes per week")} />
              <PlanRow label="Preferred mode" value={readValue(conditioningTargets, ["preferred_mode", "mode"], "Incline walk, treadmill, bike, intervals, ropes, sled, outdoor walk/run")} />
              <PlanRow label="Intensity" value={readValue(conditioningTargets, ["intensity", "zone", "rpe"], "Zone 2, intervals, RPE, heart-rate target, or simple duration target")} />
              <PlanRow label="Steps / NEAT" value={readValue(activityTargets, ["steps_per_day", "step_target", "neat"], "Daily or weekly step target and general movement goal")} />
              <PlanRow label="Wearables" value={readValue(activityTargets, ["wearable_source", "source"], "Future source for steps, calories, heart rate, HRV, sleep, zone minutes")} />
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-4">
          <SectionCard id="body-state" eyebrow="Dependent variables" title="Current Body State">
            <div className="grid gap-1">
              <PlanRow label="Weight" value={readValue(bodyState, ["weight_lb", "weight", "body_weight"], "Current body weight and trend")} />
              <PlanRow label="Measurements" value={readValue(bodyState, ["measurements", "waist_in", "waist"], "Waist, chest, arms, thighs, hips, calves")} />
              <PlanRow label="Body composition" value={readValue(bodyState, ["body_fat_percent", "body_composition"], "Estimate method and confidence")} />
              <PlanRow label="Calipers" value={readValue(bodyState, ["calipers", "caliper_sites"], "Site measurements and formula later")} />
              <PlanRow label="Body scan" value={readValue(bodyState, ["body_scan", "scan"], "DEXA / InBody / 3D scan placeholder")} />
            </div>
          </SectionCard>

          <SectionCard id="recovery-targets" eyebrow="Recovery prescription" title="Sleep and Recovery">
            <div className="grid gap-1">
              <PlanRow label="Sleep target" value={readValue(recoveryTargets, ["sleep_hours", "sleep_target"], "Hours, consistency, wakeups, and quality")} />
              <PlanRow label="Rest days" value={readValue(recoveryTargets, ["rest_days", "rest"], "Planned rest or low-stress activity days")} />
              <PlanRow label="Mobility" value={readValue(recoveryTargets, ["mobility_goal", "mobility"], "Flexibility, stretching, rehab, or movement-prep goal")} />
              <PlanRow label="Fatigue watch" value={readValue(recoveryTargets, ["fatigue_watch", "fatigue"], "Soreness, joint pain, motivation, performance drop")} />
            </div>
          </SectionCard>

          <SectionCard id="monitoring-rules" eyebrow="Adjustment logic" title="Monitoring and Adjustment Rules">
            <div className="grid gap-2">
              <div>
                {readValue(
                  monitoringRules,
                  ["summary", "adjustment_rule", "rules"],
                  "Define what changes the plan: weight trend, waist change, training performance, adherence, hunger, sleep, fatigue, and recovery."
                )}
              </div>
              <div>This is the bridge from plan → capture/log → analysis.</div>
            </div>
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
