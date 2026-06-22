"use client";

import { authFetch } from "@/lib/authFetch";
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

type RangeDays = 7 | 14 | 30 | 90;

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
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
  const [status, setStatus] = React.useState("loading...");
  const [loading, setLoading] = React.useState(true);

  const [strengthSessions, setStrengthSessions] = React.useState<TrainingSessionRow[]>([]);
  const [conditioningSessions, setConditioningSessions] = React.useState<ConditioningSessionRow[]>([]);

  const today = React.useMemo(() => todayLocalYYYYMMDD(), []);
  const startDay = React.useMemo(() => daysAgoYYYYMMDD(rangeDays - 1), [rangeDays]);

  async function loadRows() {
    setLoading(true);
    setStatus("loading training analysis...");

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
      setStatus(`loaded ${strengthArr.length} strength sessions and ${conditioningArr.length} conditioning sessions`);
    } catch (e: any) {
      setStrengthSessions([]);
      setConditioningSessions([]);
      setStatus(`error: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadRows();
  }, []);

  const filteredStrength = React.useMemo(() => {
    return strengthSessions.filter((s) => {
      const day = String(s.day || "");
      return day >= startDay && day <= today;
    });
  }, [strengthSessions, startDay, today]);

  const filteredConditioning = React.useMemo(() => {
    return conditioningSessions.filter((s) => {
      const day = String(s.day || "");
      return day >= startDay && day <= today;
    });
  }, [conditioningSessions, startDay, today]);

  const summary = React.useMemo(() => {
    const strengthDays = new Set<string>();
    const conditioningDays = new Set<string>();

    for (const s of filteredStrength) {
      if (s.day) strengthDays.add(String(s.day));
    }

    for (const c of filteredConditioning) {
      if (c.day) conditioningDays.add(String(c.day));
    }

    const allTrainingDays = new Set<string>([...Array.from(strengthDays), ...Array.from(conditioningDays)]);

    const sets = filteredStrength.reduce((acc, x) => acc + safeNum(x.set_count, 0), 0);
    const volume = filteredStrength.reduce((acc, x) => acc + safeNum(x.volume, 0), 0);
    const exercises = filteredStrength.reduce((acc, x) => acc + safeNum(x.exercise_count, 0), 0);
    const conditioningMinutes = filteredConditioning.reduce((acc, x) => acc + safeNum(x.duration_min, 0), 0);

    return {
      strengthSessions: filteredStrength.length,
      conditioningSessions: filteredConditioning.length,
      strengthDays: strengthDays.size,
      conditioningDays: conditioningDays.size,
      trainingDays: allTrainingDays.size,
      sets,
      volume,
      exercises,
      conditioningMinutes,
    };
  }, [filteredStrength, filteredConditioning]);

  const recentItems = React.useMemo(() => {
    const strength = filteredStrength.map((s) => ({
      id: `strength:${s.training_session_id}`,
      day: s.day,
      created_at: s.created_at,
      kind: "Strength",
      name: s.name,
      detail: `${safeNum(s.exercise_count, 0)} exercises · ${safeNum(s.set_count, 0)} sets · volume ${formatK(safeNum(s.volume, 0))}`,
      notes: s.notes || "",
    }));

    const conditioning = filteredConditioning.map((c) => ({
      id: `conditioning:${c.conditioning_session_log_id}`,
      day: c.day,
      created_at: c.created_at,
      kind: "Conditioning",
      name: c.name,
      detail: `${formatDuration(safeNum(c.duration_min, 0))}${c.distance ? ` · ${c.distance}` : ""}${c.intensity ? ` · ${c.intensity}` : ""}`,
      notes: c.notes || "",
    }));

    return [...strength, ...conditioning]
      .sort((a, b) => {
        const c = String(b.day || "").localeCompare(String(a.day || ""));
        if (c !== 0) return c;
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      })
      .slice(0, 20);
  }, [filteredStrength, filteredConditioning]);

  return (
    <div className="mx-auto max-w-6xl p-4 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Training · Analyze</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Read-only training dashboard from completed strength and conditioning logs.
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Range: {startDay} → {today}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              className={`rounded-full border px-3 py-1 text-sm ${rangeDays === d ? "border-foreground bg-foreground text-background" : "hover:bg-muted/20"}`}
              onClick={() => setRangeDays(d as RangeDays)}
            >
              {d}d
            </button>
          ))}

          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30"
            onClick={() => void loadRows()}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted-foreground">Debug</summary>
        <div className="mt-2 text-xs font-mono text-muted-foreground">{status}</div>
      </details>

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Training days" value={summary.trainingDays} sub={`${summary.strengthDays} strength · ${summary.conditioningDays} conditioning`} />
        <MetricCard label="Strength sessions" value={summary.strengthSessions} sub={`${summary.sets} sets · ${summary.exercises} exercises`} />
        <MetricCard label="Strength volume" value={formatK(summary.volume)} sub="logged load × reps" />
        <MetricCard label="Conditioning" value={formatDuration(summary.conditioningMinutes)} sub={`${summary.conditioningSessions} sessions`} />
      </section>

      <section className="mt-6 rounded-xl border p-4">
        <div className="text-sm font-semibold">Current read</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {summary.trainingDays ? (
            <>
              In the selected range, training occurred on {summary.trainingDays} day{summary.trainingDays === 1 ? "" : "s"}.
              Strength work produced {summary.sets} logged sets and {formatK(summary.volume)} total volume.
              Conditioning added {formatDuration(summary.conditioningMinutes)} across {summary.conditioningSessions} session
              {summary.conditioningSessions === 1 ? "" : "s"}.
            </>
          ) : (
            <>No completed strength or conditioning sessions were found in this range.</>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Recent training events</div>
            <div className="mt-1 text-xs text-muted-foreground">Strength and conditioning logs in this range.</div>
          </div>
          <div className="text-xs text-muted-foreground">count={recentItems.length}</div>
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

      <section className="mt-6 rounded-xl border p-4">
        <div className="text-sm font-semibold">Graph explorer</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Next pass: add metric dropdowns and ABA-style single-subject graphs for volume, sets, sessions, conditioning time, and later nutrition/bodyweight overlays.
        </div>
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
