"use client";

import { authFetch } from "@/lib/authFetch";
import { MiniLineChart, type XYPoint } from "@/components/sslg/MiniLineChart";
import { calculateStrengthFrequency } from "./strengthFrequency";
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

function dailyStrengthSeries(
  sessions: TrainingSessionRow[],
  metric: "sessions" | "sets" | "volume"
): XYPoint[] {
  const byDay = new Map<string, number>();

  for (const s of sessions) {
    const day = String(s.day || "").slice(0, 10);
    if (!day) continue;

    const value =
      metric === "sessions"
        ? 1
        : metric === "sets"
          ? strengthMetric(s, "strength_set_count", "set_count")
          : strengthMetric(s, "strength_volume", "volume");

    byDay.set(day, safeNum(byDay.get(day), 0) + value);
  }

  return Array.from(byDay.entries())
    .map(([day, y]) => ({
      x: day,
      y,
      id: day,
      occurred_at: day,
      sort_ts: day,
      data: { day, metric },
    }))
    .sort((a, b) => String(a.sort_ts || a.x).localeCompare(String(b.sort_ts || b.x)));
}

function dailyConditioningSeries(sessions: ConditioningSessionRow[]): XYPoint[] {
  const byDay = new Map<string, number>();

  for (const s of sessions) {
    const day = String(s.day || "").slice(0, 10);
    if (!day) continue;

    byDay.set(day, safeNum(byDay.get(day), 0) + safeNum(s.duration_min, 0));
  }

  return Array.from(byDay.entries())
    .map(([day, y]) => ({
      x: day,
      y,
      id: day,
      occurred_at: day,
      sort_ts: day,
      data: { day, metric: "conditioning_minutes" },
    }))
    .sort((a, b) => String(a.sort_ts || a.x).localeCompare(String(b.sort_ts || b.x)));
}

function dailyRehabSetSeries(sessions: TrainingSessionRow[]): XYPoint[] {
  const byDay = new Map<string, number>();

  for (const session of sessions) {
    const day = String(session.day || "").slice(0, 10);
    if (!day || !hasRehabWork(session)) continue;
    const sets = rehabMetric(session, "rehab_set_count", "set_count");
    byDay.set(day, safeNum(byDay.get(day), 0) + sets);
  }

  return Array.from(byDay.entries())
    .map(([day, y]) => ({
      x: day,
      y,
      id: day,
      occurred_at: day,
      sort_ts: day,
      data: { day, metric: "rehab_sets" },
    }))
    .sort((a, b) => String(a.sort_ts || a.x).localeCompare(String(b.sort_ts || b.x)));
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
  const [trainingTargets, setTrainingTargets] = React.useState<Record<string, unknown> | null>(null);
  const [planEvidence, setPlanEvidence] = React.useState("Active Plan not loaded");
  const showDebug =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

  const today = React.useMemo(() => todayLocalYYYYMMDD(), []);
  const startDay = React.useMemo(() => daysAgoYYYYMMDD(rangeDays - 1), [rangeDays]);

  async function loadRows() {
    setLoading(true);
    setStatus("loading training analysis…");

    try {
      const [strengthJson, conditioningJson, planResult] = await Promise.all([
        fetchJson("/api/lifeswitch/training/sessions?limit=500"),
        fetchJson("/api/lifeswitch/training/conditioning_sessions?limit=500"),
        fetchJson("/api/lifeswitch/plan/agentic/active")
          .then((value) => ({ value, failed: false }))
          .catch(() => ({ value: null, failed: true })),
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
      const activePlan = planResult.value?.active_plan;
      const activeDocument = activePlan?.document;
      if (activeDocument && typeof activeDocument === "object" && !Array.isArray(activeDocument)) {
        const nextTargets = activeDocument.training_targets;
        setTrainingTargets(
          nextTargets && typeof nextTargets === "object" && !Array.isArray(nextTargets)
            ? (nextTargets as Record<string, unknown>)
            : {},
        );
        setPlanEvidence(
          activePlan.version_number != null
            ? `Active Plan v${activePlan.version_number}`
            : "Active Plan",
        );
      } else {
        setTrainingTargets(null);
        setPlanEvidence(planResult.failed ? "Active Plan unavailable" : "No active Plan");
      }
      setStatus(`loaded ${strengthArr.length} resistance sessions and ${conditioningArr.length} conditioning sessions`);
    } catch (e: any) {
      setStrengthSessions([]);
      setConditioningSessions([]);
      setTrainingTargets(null);
      setPlanEvidence("Active Plan unavailable");
      setStatus(`error: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadRows();
  }, []);

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

  const strengthFrequency = React.useMemo(
    () =>
      calculateStrengthFrequency({
        sessions: strengthSessions,
        trainingTargets,
        today,
      }),
    [strengthSessions, trainingTargets, today],
  );

  const strengthFrequencyStatus = {
    met: "Met",
    below: "Below",
    above: "Above",
    insufficient_data: "Insufficient data",
  }[strengthFrequency.status];

  const strengthFrequencyStatusClass = {
    met: "border-emerald-700/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    below: "border-amber-700/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    above: "border-sky-700/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    insufficient_data: "border-muted-foreground/30 bg-muted/30 text-muted-foreground",
  }[strengthFrequency.status];

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

  const strengthSessionsSeries = React.useMemo(
    () => dailyStrengthSeries(filteredStrength, "sessions"),
    [filteredStrength]
  );

  const strengthSetsSeries = React.useMemo(
    () => dailyStrengthSeries(filteredStrength, "sets"),
    [filteredStrength]
  );

  const strengthVolumeSeries = React.useMemo(
    () => dailyStrengthSeries(filteredStrength, "volume"),
    [filteredStrength]
  );

  const conditioningMinutesSeries = React.useMemo(
    () => dailyConditioningSeries(filteredConditioning),
    [filteredConditioning]
  );

  const rehabSetsSeries = React.useMemo(
    () => dailyRehabSetSeries(filteredRehab),
    [filteredRehab],
  );

  const recentItems = React.useMemo(() => {
    const resistance = filteredResistance.map((s) => {
      const role = trainingSessionRole(s);
      const strengthSets = strengthMetric(s, "strength_set_count", "set_count");
      const strengthExercises = strengthMetric(s, "strength_exercise_count", "exercise_count");
      const strengthVolume = strengthMetric(s, "strength_volume", "volume");
      const rehabSets = rehabMetric(s, "rehab_set_count", "set_count");
      const rehabExercises = rehabMetric(s, "rehab_exercise_count", "exercise_count");
      const strengthDetail = strengthSets
        ? `${strengthExercises} strength exercises · ${strengthSets} strength sets · volume ${formatK(strengthVolume)}`
        : "";
      const rehabDetail = rehabSets
        ? `${rehabExercises} rehab exercises · ${rehabSets} rehab sets`
        : "";

      return {
        id: `resistance:${s.training_session_id}`,
        day: s.day,
        created_at: s.created_at,
        kind: role === "mixed" ? "Strength + rehab" : role === "rehab" ? "Rehab" : role === "unclassified" ? "Unclassified" : "Strength",
        name: s.name,
        detail: [strengthDetail, rehabDetail].filter(Boolean).join(" · ") || `${safeNum(s.set_count, 0)} sets`,
        notes: s.notes || "",
      };
    });

    const conditioning = filteredConditioning.map((c) => ({
      id: `conditioning:${c.conditioning_session_log_id}`,
      day: c.day,
      created_at: c.created_at,
      kind: "Conditioning",
      name: c.name,
      detail: `${formatDuration(safeNum(c.duration_min, 0))}${c.distance ? ` · ${c.distance}` : ""}${c.intensity ? ` · ${c.intensity}` : ""}`,
      notes: c.notes || "",
    }));

    return [...resistance, ...conditioning]
      .sort((a, b) => {
        const c = String(b.day || "").localeCompare(String(a.day || ""));
        if (c !== 0) return c;
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      })
      .slice(0, 20);
  }, [filteredResistance, filteredConditioning]);

  return (
    <div className="mx-auto max-w-6xl p-4 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Training · Analyze</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Read-only training dashboard from completed strength, rehab, and conditioning logs.
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Range: {startDay} → {today}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
              className={`rounded-full border px-3 py-1 text-sm ${rangeDays === r.value ? "border-foreground bg-foreground text-background" : "hover:bg-muted/20"}`}
              onClick={() => setRangeDays(r.value as RangeDays)}
            >
              {r.label}
            </button>
          ))}

          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30"
            onClick={() => void loadRows()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {showDebug ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground">Debug</summary>
          <div className="mt-2 text-xs font-mono text-muted-foreground">{status}</div>
        </details>
      ) : null}

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Training days" value={summary.trainingDays} sub={`${summary.strengthDays} strength · ${summary.rehabDays} rehab · ${summary.conditioningDays} conditioning`} />
        <MetricCard label="Strength sessions" value={summary.strengthSessions} sub={`${summary.sets} sets · ${summary.exercises} exercises`} />
        <MetricCard label="Strength volume" value={formatK(summary.volume)} sub="logged load × reps" />
        <MetricCard label="Rehab" value={`${summary.rehabDays} days`} sub={`${summary.rehabSessions} sessions · ${summary.rehabSets} sets`} />
        <MetricCard label="Conditioning" value={formatDuration(summary.conditioningMinutes)} sub={`${summary.conditioningSessions} sessions`} />
      </section>

      <section className="mt-6 rounded-xl border p-4" aria-label="Plan versus actual strength frequency">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Plan vs actual · Strength frequency</div>
            <div className="mt-1 text-xs text-muted-foreground">{planEvidence}</div>
          </div>
          <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${strengthFrequencyStatusClass}`}>
            {strengthFrequencyStatus}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Planned</div>
            <div className="mt-2 text-2xl font-semibold">
              {strengthFrequency.target?.label ?? "Not set"}
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed</div>
            <div className="mt-2 text-2xl font-semibold">{strengthFrequency.completed}</div>
            <div className="mt-1 text-xs text-muted-foreground">canonical strength sessions</div>
          </div>
        </div>

        <div className="mt-4 space-y-1 text-xs text-muted-foreground">
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

        {strengthFrequency.excluded.unclassified > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-700/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            {strengthFrequency.excluded.unclassified} unclassified session{strengthFrequency.excluded.unclassified === 1 ? " was" : "s were"} excluded. Classify historical sessions explicitly before using them as strength evidence.
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-xl border p-4">
        <div className="text-sm font-semibold">Current read</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {summary.trainingDays ? (
            <>
              In the selected range, training occurred on {summary.trainingDays} day{summary.trainingDays === 1 ? "" : "s"}.
              Strength work produced {summary.sets} logged sets and {formatK(summary.volume)} total volume.
              Rehab/prehab occurred on {summary.rehabDays} day{summary.rehabDays === 1 ? "" : "s"} with {summary.rehabSets} logged sets and is excluded from strength totals.
              Conditioning added {formatDuration(summary.conditioningMinutes)} across {summary.conditioningSessions} session
              {summary.conditioningSessions === 1 ? "" : "s"}.
            </>
          ) : (
            <>No completed strength, rehab, or conditioning sessions were found in this range.</>
          )}
        </div>
      </section>
      <section className="mt-6 grid gap-4">
        <div>
          <div className="text-sm font-semibold">Training trends</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Strength, rehab, and conditioning patterns across completed training days.
          </p>
        </div>

        <MiniLineChart
          title="Strength sessions per training day"
          series={strengthSessionsSeries}
          xMode="date"
          yLabel="Sessions"
          includeZero={false}
          heightPx={260}
        />

        <MiniLineChart
          title="Strength sets per training day"
          series={strengthSetsSeries}
          xMode="date"
          yLabel="Sets"
          includeZero={false}
          heightPx={260}
        />

        <MiniLineChart
          title="Strength volume per training day"
          series={strengthVolumeSeries}
          xMode="date"
          yLabel="Volume"
          includeZero={false}
          heightPx={260}
        />

        <MiniLineChart
          title="Rehab sets per day"
          series={rehabSetsSeries}
          xMode="date"
          yLabel="Sets"
          includeZero={false}
          heightPx={260}
        />

        <MiniLineChart
          title="Conditioning minutes per day"
          series={conditioningMinutesSeries}
          xMode="date"
          yLabel="Minutes"
          includeZero={false}
          heightPx={260}
        />
      </section>
      <section className="mt-6 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Recent training events</div>
            <div className="mt-1 text-xs text-muted-foreground">Strength, rehab, and conditioning logs in this range.</div>
          </div>
          <div className="text-xs text-muted-foreground">
            {recentItems.length} event{recentItems.length === 1 ? "" : "s"}
          </div>
        </div>

        {recentItems.length ? (
          <div className="mt-4 space-y-3">
            {recentItems.map((item) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{item.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.kind} · {item.day} · {item.detail}
                    </div>
                    {item.notes ? <div className="mt-2 text-xs text-muted-foreground">{item.notes}</div> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border p-4 text-sm text-muted-foreground">
            No training events in this range.
          </div>
        )}
      </section>

    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
