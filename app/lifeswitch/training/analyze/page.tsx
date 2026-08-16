"use client";

import { authFetch } from "@/lib/authFetch";
import { MiniLineChart, type XYPoint } from "@/components/sslg/MiniLineChart";
import {
  recoveryDaysForDomain,
  type RecoveryAdjustment,
} from "@/lib/lifeswitch/recoveryAdjustments";
import { calculateStrengthFrequency } from "./strengthFrequency";
import {
  calculateStrengthProgression,
  comparableStrengthExposureRows,
  describeStrengthProgression,
  type StrengthExposureRow,
} from "./strengthProgression";
import * as React from "react";

type TrainingSessionRow = {
  training_session_id: string;
  owner_user_id: string;
  day: string;
  workout_template_id?: string | null;
  name: string;
  notes?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  set_count: number;
  exercise_count: number;
  volume: number;
  strength_set_count?: number;
  strength_exercise_count?: number;
  strength_volume?: number;
  rehab_set_count?: number;
  rehab_exercise_count?: number;
  rehab_volume?: number;
  session_role?: "strength" | "rehab" | "mixed" | "unclassified";
  counts_toward_strength?: boolean;
};

type ConditioningSessionRow = {
  conditioning_session_log_id: string;
  owner_user_id: string;
  my_conditioning_prescription_id?: string | null;
  day: string;
  name: string;
  category: string;
  modality: string;
  duration_min: number;
  intensity: string;
  distance: string;
  heart_rate_avg?: number | null;
  recovery_impact: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  prescription_name?: string | null;
};

type RangeDays = 10 | 30 | 90 | 180 | 365;
type ProgressionMetric = "max_load" | "total_reps" | "total_volume";

const PROGRESSION_METRICS: Array<{ value: ProgressionMetric; label: string }> = [
  { value: "max_load", label: "Top load" },
  { value: "total_reps", label: "Total reps" },
  { value: "total_volume", label: "Volume" },
];

function analysisChoiceClassName(active: boolean) {
  return `inline-flex min-h-11 min-w-11 items-center justify-center border-b-2 px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
    active
      ? "border-foreground text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground"
  }`;
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function trainingSessionRole(
  row: TrainingSessionRow,
): "strength" | "rehab" | "mixed" | "unclassified" {
  if (["strength", "rehab", "mixed", "unclassified"].includes(String(row.session_role))) {
    return row.session_role as "strength" | "rehab" | "mixed" | "unclassified";
  }

  const strengthSets = safeNum(row.strength_set_count, 0);
  const rehabSets = safeNum(row.rehab_set_count, 0);
  if (strengthSets > 0 && rehabSets > 0) return "mixed";
  if (rehabSets > 0) return "rehab";
  if (strengthSets > 0) return "strength";
  return "strength";
}

function countsTowardStrength(row: TrainingSessionRow) {
  if (typeof row.counts_toward_strength === "boolean") {
    return row.counts_toward_strength;
  }
  const role = trainingSessionRole(row);
  return role === "strength" || role === "mixed";
}

function hasRehabWork(row: TrainingSessionRow) {
  const role = trainingSessionRole(row);
  return role === "rehab" || role === "mixed" || safeNum(row.rehab_set_count, 0) > 0;
}

function strengthMetric(row: TrainingSessionRow, summaryKey: "strength_set_count" | "strength_exercise_count" | "strength_volume", fallbackKey: "set_count" | "exercise_count" | "volume") {
  if (row[summaryKey] != null) return safeNum(row[summaryKey], 0);
  return countsTowardStrength(row) ? safeNum(row[fallbackKey], 0) : 0;
}

function rehabMetric(row: TrainingSessionRow, summaryKey: "rehab_set_count" | "rehab_exercise_count" | "rehab_volume", fallbackKey: "set_count" | "exercise_count" | "volume") {
  if (row[summaryKey] != null) return safeNum(row[summaryKey], 0);
  return trainingSessionRole(row) === "rehab" ? safeNum(row[fallbackKey], 0) : 0;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function todayLocalYYYYMMDD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function daysAgoYYYYMMDD(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatK(n: number) {
  const x = safeNum(n, 0);
  const abs = Math.abs(x);

  if (abs >= 1_000_000) {
    const v = Math.round((x / 1_000_000) * 10) / 10;
    return `${String(v).replace(/\.0$/, "")}M`;
  }

  if (abs >= 1_000) {
    const v = Math.round(x / 1_000);
    return `${v}K`;
  }

  return String(Math.round(x));
}

function formatDuration(min: number) {
  const x = safeNum(min, 0);
  if (x >= 60) {
    const h = Math.round((x / 60) * 10) / 10;
    return `${String(h).replace(/\.0$/, "")} hr`;
  }
  return `${Math.round(x)} min`;
}

function formatMetricNumber(value: number) {
  const rounded = Math.round(safeNum(value, 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatLoad(value: number, unit: string | null) {
  const numeric = safeNum(value, 0);
  if (!unit && numeric === 0) return "Unloaded";
  return `${formatMetricNumber(numeric)}${unit ? ` ${unit}` : ""}`;
}

async function fetchJson(url: string, init?: RequestInit) {
  const r = await authFetch(url, { cache: "no-store", ...(init || {}) });
  const t = await r.text().catch(() => "");
  let j: any = null;

  try {
    j = t ? JSON.parse(t) : null;
  } catch {
    // keep null
  }

  if (!r.ok) {
    const detail = j?.detail || j?.error || t?.slice(0, 300) || `HTTP ${r.status}`;
    throw new Error(String(detail));
  }

  return j;
}

export default function TrainingAnalyzePage() {
  const [rangeDays, setRangeDays] = React.useState<RangeDays>(30);
  const [status, setStatus] = React.useState("loading…");
  const [loading, setLoading] = React.useState(true);

  const [strengthSessions, setStrengthSessions] = React.useState<TrainingSessionRow[]>([]);
  const [conditioningSessions, setConditioningSessions] = React.useState<ConditioningSessionRow[]>([]);
  const [progressionRows, setProgressionRows] = React.useState<StrengthExposureRow[]>([]);
  const [progressionLoading, setProgressionLoading] = React.useState(true);
  const [progressionError, setProgressionError] = React.useState("");
  const [selectedExerciseId, setSelectedExerciseId] = React.useState("");
  const [progressionMetric, setProgressionMetric] = React.useState<ProgressionMetric>("max_load");
  const [trainingTargets, setTrainingTargets] = React.useState<Record<string, unknown> | null>(null);
  const [planEvidence, setPlanEvidence] = React.useState("Targets not configured");
  const [recoveryAdjustments, setRecoveryAdjustments] = React.useState<
    RecoveryAdjustment[]
  >([]);
  const showDebug =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

  const today = React.useMemo(() => todayLocalYYYYMMDD(), []);
  const startDay = React.useMemo(() => daysAgoYYYYMMDD(rangeDays - 1), [rangeDays]);

  async function loadRows() {
    setLoading(true);
    setStatus("loading training analysis…");

    try {
      const [strengthJson, conditioningJson] = await Promise.all([
        fetchJson("/api/lifeswitch/training/sessions?limit=500"),
        fetchJson("/api/lifeswitch/training/conditioning_sessions?limit=500"),
      ]);

      const strengthArr = Array.isArray(strengthJson) ? (strengthJson as TrainingSessionRow[]) : [];
      const conditioningArr = Array.isArray(conditioningJson) ? (conditioningJson as ConditioningSessionRow[]) : [];

      strengthArr.sort((a, b) => {
        const c = String(b.day || "").localeCompare(String(a.day || ""));
        if (c !== 0) return c;
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });

      conditioningArr.sort((a, b) => {
        const c = String(b.day || "").localeCompare(String(a.day || ""));
        if (c !== 0) return c;
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });

      setStrengthSessions(strengthArr);
      setConditioningSessions(conditioningArr);
      setRecoveryAdjustments([]);
      setTrainingTargets(null);
      setPlanEvidence("Targets not configured");
      setStatus(`loaded ${strengthArr.length} resistance sessions and ${conditioningArr.length} conditioning sessions`);
    } catch (e: any) {
      setStrengthSessions([]);
      setConditioningSessions([]);
      setRecoveryAdjustments([]);
      setTrainingTargets(null);
      setPlanEvidence("Targets not configured");
      setStatus(`error: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadProgressionRows() {
    setProgressionLoading(true);
    setProgressionError("");
    const query = new URLSearchParams({
      start_day: startDay,
      end_day: today,
      limit: "5000",
    });

    try {
      const result = await fetchJson(`/api/lifeswitch/training/progression?${query.toString()}`);
      setProgressionRows(Array.isArray(result) ? (result as StrengthExposureRow[]) : []);
    } catch (error: any) {
      setProgressionRows([]);
      setProgressionError(String(error?.message || error));
    } finally {
      setProgressionLoading(false);
    }
  }

  React.useEffect(() => {
    void loadRows();
  }, []);

  React.useEffect(() => {
    void loadProgressionRows();
  }, [startDay, today]);

  const filteredResistance = React.useMemo(() => {
    return strengthSessions.filter((s) => {
      const day = String(s.day || "");
      return day >= startDay && day <= today;
    });
  }, [strengthSessions, startDay, today]);

  const filteredStrength = React.useMemo(
    () => filteredResistance.filter(countsTowardStrength),
    [filteredResistance],
  );

  const filteredRehab = React.useMemo(
    () => filteredResistance.filter(hasRehabWork),
    [filteredResistance],
  );

  const filteredConditioning = React.useMemo(() => {
    return conditioningSessions.filter((s) => {
      const day = String(s.day || "");
      return day >= startDay && day <= today;
    });
  }, [conditioningSessions, startDay, today]);

  const strengthRecoveryDays = React.useMemo(
    () => recoveryDaysForDomain(recoveryAdjustments, "strength"),
    [recoveryAdjustments],
  );
  const strengthFrequency = React.useMemo(
    () =>
      calculateStrengthFrequency({
        sessions: strengthSessions,
        trainingTargets,
        today,
        recoveryDays: strengthRecoveryDays,
      }),
    [strengthRecoveryDays, strengthSessions, trainingTargets, today],
  );

  const strengthFrequencyStatus = {
    met: "Met",
    below: "Below",
    above: "Above",
    insufficient_data: "Insufficient data",
    paused: "Paused for recovery",
  }[strengthFrequency.status];

  const strengthFrequencyStatusClass = {
    met: "text-emerald-700 dark:text-emerald-300",
    below: "text-amber-700 dark:text-amber-300",
    above: "text-sky-700 dark:text-sky-300",
    insufficient_data: "text-muted-foreground",
    paused: "text-violet-700 dark:text-violet-300",
  }[strengthFrequency.status];

  const strengthProgression = React.useMemo(
    () => calculateStrengthProgression(progressionRows),
    [progressionRows],
  );

  React.useEffect(() => {
    if (!strengthProgression.length) {
      setSelectedExerciseId("");
      return;
    }
    if (strengthProgression.some((item) => item.exerciseId === selectedExerciseId)) return;
    const defaultItem =
      strengthProgression.find((item) => item.comparisonStatus === "comparable") ??
      strengthProgression[0];
    setSelectedExerciseId(defaultItem.exerciseId);
  }, [strengthProgression, selectedExerciseId]);

  const progressionSufficiency = React.useMemo(
    () => ({
      comparable: strengthProgression.filter((item) => item.comparisonStatus === "comparable").length,
      baseline: strengthProgression.filter((item) => item.comparisonStatus === "baseline").length,
      unitMismatch: strengthProgression.filter(
        (item) => item.comparisonStatus === "no_comparable_exposure",
      ).length,
    }),
    [strengthProgression],
  );

  const selectedProgression = strengthProgression.find(
    (item) => item.exerciseId === selectedExerciseId,
  );
  const selectedProgressionRows = React.useMemo(
    () => comparableStrengthExposureRows(progressionRows, selectedExerciseId),
    [progressionRows, selectedExerciseId],
  );
  const selectedProgressionSignal = selectedProgression
    ? describeStrengthProgression(selectedProgression)
    : null;
  const selectedLoadUnit = selectedProgression?.latest.loadUnit ?? null;
  const progressionMetricLabel =
    PROGRESSION_METRICS.find((metric) => metric.value === progressionMetric)?.label ??
    "Progression";
  const progressionSeries = React.useMemo<XYPoint[]>(
    () =>
      selectedProgressionRows.map((row) => ({
        x: String(row.day || "").slice(0, 10),
        y: safeNum(row[progressionMetric], 0),
        id: `${row.training_session_id}:${row.exercise_id}`,
        occurred_at: String(row.day || "").slice(0, 10),
        sort_ts: `${String(row.day || "").slice(0, 10)}:${row.training_session_id}`,
        data: row,
      })),
    [selectedProgressionRows, progressionMetric],
  );
  const progressionYAxisLabel =
    progressionMetric === "max_load"
      ? selectedLoadUnit
        ? `Load (${selectedLoadUnit})`
        : "Load"
      : progressionMetric === "total_reps"
        ? "Total reps"
        : selectedLoadUnit
          ? `Volume (${selectedLoadUnit} × reps)`
          : "Volume";
  const progressionYSuffix =
    progressionMetric === "max_load" && selectedLoadUnit
      ? ` ${selectedLoadUnit}`
      : "";

  const summary = React.useMemo(() => {
    const strengthDays = new Set<string>();
    const rehabDays = new Set<string>();
    const conditioningDays = new Set<string>();

    for (const s of filteredStrength) {
      if (s.day) strengthDays.add(String(s.day));
    }

    for (const s of filteredRehab) {
      if (s.day) rehabDays.add(String(s.day));
    }

    for (const c of filteredConditioning) {
      if (c.day) conditioningDays.add(String(c.day));
    }

    const allTrainingDays = new Set<string>([
      ...Array.from(strengthDays),
      ...Array.from(rehabDays),
      ...Array.from(conditioningDays),
    ]);

    const sets = filteredStrength.reduce(
      (acc, x) => acc + strengthMetric(x, "strength_set_count", "set_count"),
      0,
    );
    const volume = filteredStrength.reduce(
      (acc, x) => acc + strengthMetric(x, "strength_volume", "volume"),
      0,
    );
    const exercises = filteredStrength.reduce(
      (acc, x) => acc + strengthMetric(x, "strength_exercise_count", "exercise_count"),
      0,
    );
    const rehabSets = filteredRehab.reduce(
      (acc, x) => acc + rehabMetric(x, "rehab_set_count", "set_count"),
      0,
    );
    const conditioningMinutes = filteredConditioning.reduce((acc, x) => acc + safeNum(x.duration_min, 0), 0);

    return {
      strengthSessions: filteredStrength.length,
      conditioningSessions: filteredConditioning.length,
      rehabSessions: filteredRehab.length,
      strengthDays: strengthDays.size,
      rehabDays: rehabDays.size,
      conditioningDays: conditioningDays.size,
      trainingDays: allTrainingDays.size,
      sets,
      volume,
      exercises,
      rehabSets,
      conditioningMinutes,
    };
  }, [filteredStrength, filteredRehab, filteredConditioning]);

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <h1 className="text-xl font-semibold">Training · Analyze</h1>
          <div className="mt-1 text-xs text-muted-foreground">{startDay} → {today}</div>
        </div>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Analysis range">
          {[
            { value: 10, label: "10d" },
            { value: 30, label: "30d" },
            { value: 90, label: "90d" },
            { value: 180, label: "6mo" },
            { value: 365, label: "1y" },
          ].map((r) => (
            <button
              key={r.value}
              type="button"
              className={analysisChoiceClassName(rangeDays === r.value)}
              aria-pressed={rangeDays === r.value}
              onClick={() => setRangeDays(r.value as RangeDays)}
            >
              {r.label}
            </button>
          ))}

          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => {
              void loadRows();
              void loadProgressionRows();
            }}
            disabled={loading || progressionLoading}
          >
            {loading || progressionLoading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {showDebug ? (
        <details className="mt-4">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground">Debug</summary>
          <div className="mt-2 text-xs font-mono text-muted-foreground">{status}</div>
        </details>
      ) : null}

      <section className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border/50 py-3 md:grid-cols-5">
        <MetricCard label="Training days" value={summary.trainingDays} sub={`${summary.strengthDays} strength · ${summary.rehabDays} rehab · ${summary.conditioningDays} conditioning`} />
        <MetricCard label="Strength sessions" value={summary.strengthSessions} sub={`${summary.sets} sets · ${summary.exercises} exercises`} />
        <MetricCard label="Strength volume" value={formatK(summary.volume)} sub="logged load × reps" />
        <MetricCard label="Rehab" value={`${summary.rehabDays} days`} sub={`${summary.rehabSessions} sessions · ${summary.rehabSets} sets`} />
        <MetricCard label="Conditioning" value={formatDuration(summary.conditioningMinutes)} sub={`${summary.conditioningSessions} sessions`} />
      </section>

      <section className="mt-6 border-y border-border/50 py-4" aria-labelledby="strength-frequency-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="strength-frequency-title" className="text-sm font-semibold">Plan vs actual · Strength frequency</h2>
            <div className="mt-1 text-xs text-muted-foreground">{planEvidence}</div>
          </div>
          <div className={`text-xs font-semibold tracking-wide uppercase ${strengthFrequencyStatusClass}`}>
            {strengthFrequencyStatus}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 divide-x divide-border/50 border-y border-border/50 py-3">
          <div className="px-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Planned</div>
            <div className="mt-2 text-2xl font-semibold">
              {strengthFrequency.target?.label ?? "Not set"}
            </div>
          </div>
          <div className="px-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed</div>
            <div className="mt-2 text-2xl font-semibold">{strengthFrequency.completed}</div>
            <div className="mt-1 text-xs text-muted-foreground">canonical strength sessions</div>
          </div>
        </div>

        {strengthFrequency.status === "paused" ? (
          <div className="mt-4 text-sm text-muted-foreground">
            Recovery overlaps this window, so strength adherence is paused.
          </div>
        ) : null}

        <details className="mt-2 border-t border-border/40 pt-1">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground hover:text-foreground">
            How this is calculated
          </summary>
          <div className="space-y-1 pb-2 text-xs text-muted-foreground">
            <div>
              Latest completed 7-day window: {strengthFrequency.windowStart} → {strengthFrequency.windowEnd}. Today ({today}) is excluded.
            </div>
            <div>
              A completed strength or mixed strength + rehab session counts once. Rehab-only, conditioning-only, incomplete, inactive, and unclassified sessions are excluded.
            </div>
            <div>
              Excluded in this window: {strengthFrequency.excluded.rehab} rehab-only · {strengthFrequency.excluded.incomplete} incomplete · {strengthFrequency.excluded.unclassified} unclassified.
            </div>
          </div>
        </details>

        {strengthFrequency.excluded.unclassified > 0 ? (
          <div className="mt-3 border-y border-amber-700/40 py-3 text-xs text-amber-800 dark:text-amber-200">
            {strengthFrequency.excluded.unclassified} unclassified session{strengthFrequency.excluded.unclassified === 1 ? " was" : "s were"} excluded. Classify historical sessions explicitly before using them as strength evidence.
          </div>
        ) : null}
      </section>

      <section className="mt-6 border-y border-border/50 py-4" aria-labelledby="strength-progression-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="strength-progression-title" className="text-sm font-semibold">Strength progression</h2>
          <div className="text-xs text-muted-foreground">
            {strengthProgression.length} exercise{strengthProgression.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block" htmlFor="strength-progression-exercise">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exercise</span>
            <select
              id="strength-progression-exercise"
              className="mt-2 min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={selectedExerciseId}
              onChange={(event) => setSelectedExerciseId(event.target.value)}
              disabled={!strengthProgression.length}
            >
              {strengthProgression.map((item) => (
                <option key={item.exerciseId} value={item.exerciseId}>
                  {item.exerciseName}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Graph</div>
            <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Progression metric">
              {PROGRESSION_METRICS.map((metric) => (
                <button
                  key={metric.value}
                  type="button"
                  className={analysisChoiceClassName(progressionMetric === metric.value)}
                  aria-pressed={progressionMetric === metric.value}
                  onClick={() => setProgressionMetric(metric.value)}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{progressionSufficiency.comparable} with comparable history</span>
          <span>· {progressionSufficiency.baseline} baseline only</span>
          {progressionSufficiency.unitMismatch ? (
            <span>· {progressionSufficiency.unitMismatch} with unit mismatch</span>
          ) : null}
          <span>· {startDay} → {today}</span>
        </div>

        {progressionError ? (
          <div role="alert" className="mt-4 border-y border-red-700/40 py-3 text-sm text-red-700 dark:text-red-300">
            Strength progression unavailable: {progressionError}
          </div>
        ) : progressionLoading && !strengthProgression.length ? (
          <div className="mt-4 border-y border-border/50 py-3 text-sm text-muted-foreground">
            Loading strength progression…
          </div>
        ) : selectedProgression && selectedProgressionSignal ? (
          <div className="mt-4 space-y-4">
            <div className="border-l-2 border-border/60 pl-3">
              <div className="text-base font-semibold">{selectedProgressionSignal.headline}</div>
              <div className="mt-1 text-sm text-muted-foreground">{selectedProgressionSignal.detail}</div>
            </div>

            <MiniLineChart
              title={`${selectedProgression.exerciseName} · ${progressionMetricLabel}`}
              series={progressionSeries}
              xMode="date"
              xLabel="Completed exposures · oldest to newest"
              yLabel={progressionYAxisLabel}
              ySuffix={progressionYSuffix}
              includeZero={false}
              heightPx={300}
            />

            <div className="border-t border-border/50 pt-3 text-xs text-muted-foreground">
              <div>
                Latest {selectedProgression.latest.day}: {selectedProgression.latest.setCount} sets · {formatMetricNumber(selectedProgression.latest.totalReps)} reps · top {formatLoad(selectedProgression.latest.maxLoad, selectedProgression.latest.loadUnit)} · volume {formatK(selectedProgression.latest.totalVolume)}
              </div>
              {selectedProgression.previous ? (
                <div className="mt-1">
                  Previous comparable {selectedProgression.previous.day}: {selectedProgression.previous.setCount} sets · {formatMetricNumber(selectedProgression.previous.totalReps)} reps · top {formatLoad(selectedProgression.previous.maxLoad, selectedProgression.previous.loadUnit)} · volume {formatK(selectedProgression.previous.totalVolume)}
                </div>
              ) : null}
              <details className="mt-2">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground hover:text-foreground">
                  How progression is calculated
                </summary>
                <div className="pb-1">
                  Only completed classified strength work using the latest comparable load unit is graphed. The line describes recorded performance; it does not independently prove a strength change.
                </div>
              </details>
            </div>
          </div>
        ) : (
          <div className="mt-4 border-y border-border/50 py-3 text-sm text-muted-foreground">
            No completed classified strength exercises were found in this range.
          </div>
        )}
      </section>

    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
