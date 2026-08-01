"use client";

import { authFetch } from "@/lib/authFetch";
import Link from "next/link";
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
};

type TrainingSetLogRow = {
  training_set_log_id: string;
  training_session_id: string;
  owner_user_id: string;
  workout_template_id?: string | null;
  exercise_id: string;
  exercise_name: string;
  exercise_sort_order: number;
  set_index: number;
  set_type?: string | null;
  exercise_role_snapshot?: "strength" | "rehab" | null;
  exercise_role?: "strength" | "rehab";
  weight: number;
  reps: number;
  volume: number;
  flags?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type TrainingSetLogSegmentRow = {
  training_set_log_segment_id?: string;
  training_set_log_id: string;
  segment_index: number;
  label?: string | null;
  weight: number;
  reps: number;
  volume: number;
  notes?: string | null;
};

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

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function formatSessionDay(day?: string | null) {
  const value = String(day || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return value || "Date unavailable";

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function setExerciseRole(row: TrainingSetLogRow): "strength" | "rehab" {
  return row.exercise_role === "rehab" || row.exercise_role_snapshot === "rehab"
    ? "rehab"
    : "strength";
}

function groupByExercise(sets: TrainingSetLogRow[]) {
  const map = new Map<string, TrainingSetLogRow[]>();

  for (const row of sets) {
    const key = `${safeNum(row.exercise_sort_order, 0)}::${row.exercise_id}`;
    const arr = map.get(key) || [];
    arr.push(row);
    map.set(key, arr);
  }

  return Array.from(map.entries())
    .sort((a, b) => safeNum(a[1]?.[0]?.exercise_sort_order, 0) - safeNum(b[1]?.[0]?.exercise_sort_order, 0))
    .map(([key, rows]) => {
      rows.sort((a, b) => safeNum(a.set_index, 0) - safeNum(b.set_index, 0));
      const roles = new Set(rows.map(setExerciseRole));
      const role = roles.size > 1 ? "mixed" : rows[0] ? setExerciseRole(rows[0]) : "strength";
      return { key, exerciseName: rows[0]?.exercise_name || "Exercise", role, rows };
    });
}

export default function TrainingSessionPage() {
  const [session, setSession] = React.useState<TrainingSessionRow | null>(null);
  const [sets, setSets] = React.useState<TrainingSetLogRow[]>([]);
  const [segmentsBySet, setSegmentsBySet] = React.useState<Record<string, TrainingSetLogSegmentRow[]>>({});
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState("loading session...");

  const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const sessionId = String(sp.get("session_id") || "").trim();
  const targetUserId = String(sp.get("target_user_id") || "").trim();
  const targetName = String(sp.get("target_name") || "").trim();
  const readOnly = Boolean(targetUserId);
  const showDebug = String(sp.get("debug") || "") === "1";
  const targetParam = targetUserId
    ? `&target_user_id=${encodeURIComponent(targetUserId)}&target_name=${encodeURIComponent(targetName)}`
    : "";

  async function loadSession() {
    if (!sessionId) {
      setSession(null);
      setSets([]);
      setSegmentsBySet({});
      setStatus("missing session_id query param");
      setLoading(false);
      return;
    }

    setLoading(true);
    setStatus("loading session...");

    try {
      const s = (await fetchJson(
        `/api/lifeswitch/training/sessions/${encodeURIComponent(sessionId)}?${targetUserId ? `target_user_id=${encodeURIComponent(targetUserId)}` : ""}`
      )) as TrainingSessionRow;
      const rows = (await fetchJson(
        `/api/lifeswitch/training/sessions/${encodeURIComponent(sessionId)}/sets?${targetUserId ? `target_user_id=${encodeURIComponent(targetUserId)}` : ""}`
      )) as TrainingSetLogRow[];
      const setRows = Array.isArray(rows) ? rows : [];

      const dropRows = setRows.filter((row) => String(row.set_type || "straight").toLowerCase() === "drop");
      const segmentEntries = await Promise.all(
        dropRows.map(async (row) => {
          const segs = (await fetchJson(
            `/api/lifeswitch/training/sessions/${encodeURIComponent(sessionId)}/sets/${encodeURIComponent(row.training_set_log_id)}/segments${targetUserId ? `?target_user_id=${encodeURIComponent(targetUserId)}` : ""}`
          )) as TrainingSetLogSegmentRow[];

          const arr = Array.isArray(segs) ? segs.slice() : [];
          arr.sort((a, b) => safeNum(a.segment_index, 0) - safeNum(b.segment_index, 0));
          return [row.training_set_log_id, arr] as const;
        })
      );

      const segMap: Record<string, TrainingSetLogSegmentRow[]> = {};
      for (const [setId, segs] of segmentEntries) segMap[setId] = segs;

      setSession(s);
      setSets(setRows);
      setSegmentsBySet(segMap);
      setStatus(`loaded ${setRows.length} sets`);
    } catch (e: any) {
      setSession(null);
      setSets([]);
      setSegmentsBySet({});
      setStatus(`error: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }


  React.useEffect(() => {
    void loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, targetUserId]);

  const summary = React.useMemo(() => {
    const strengthExercises = new Set<string>();
    const rehabExercises = new Set<string>();
    let strengthVolume = 0;
    let strengthSetCount = 0;
    let rehabSetCount = 0;

    for (const r of sets) {
      if (setExerciseRole(r) === "rehab") {
        rehabExercises.add(r.exercise_id);
        rehabSetCount += 1;
      } else {
        strengthExercises.add(r.exercise_id);
        strengthSetCount += 1;
        strengthVolume += safeNum(r.volume, safeNum(r.weight, 0) * safeNum(r.reps, 0));
      }
    }

    return {
      strengthSetCount,
      strengthExerciseCount: strengthExercises.size,
      strengthVolume,
      rehabSetCount,
      rehabExerciseCount: rehabExercises.size,
    };
  }, [sets]);

  const byExercise = React.useMemo(() => groupByExercise(sets), [sets]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 sm:pt-7">
      {readOnly ? (
        <div className="mb-5 border-y border-border/60 py-3 text-sm text-muted-foreground" role="note">
          You are viewing {targetName ? `${targetName}’s` : "another person’s"} training session. This delegated view is read-only.
        </div>
      ) : null}

      <Link
        href={`/lifeswitch/training/calendar${targetUserId ? `?target_user_id=${encodeURIComponent(targetUserId)}&target_name=${encodeURIComponent(targetName)}` : ""}`}
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        ← Back to Training Log
      </Link>

      <header className="mt-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{session?.name || "Training Session"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {session?.day ? <time dateTime={session.day}>{formatSessionDay(session.day)}</time> : "Date unavailable"}
            </p>
          </div>

          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void loadSession()}
            disabled={loading || !sessionId}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {session && sets.length ? (
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-b border-border/60 pb-6">
            {summary.strengthExerciseCount ? (
              <div>
                <dt className="text-xs text-muted-foreground">Strength exercises</dt>
                <dd className="mt-0.5 text-base font-medium tabular-nums">{summary.strengthExerciseCount}</dd>
              </div>
            ) : null}
            {summary.strengthSetCount ? (
              <div>
                <dt className="text-xs text-muted-foreground">Strength sets</dt>
                <dd className="mt-0.5 text-base font-medium tabular-nums">{summary.strengthSetCount}</dd>
              </div>
            ) : null}
            {summary.strengthSetCount ? (
              <div>
                <dt className="text-xs text-muted-foreground">Strength volume</dt>
                <dd className="mt-0.5 text-base font-medium tabular-nums">{formatMetric(summary.strengthVolume)}</dd>
              </div>
            ) : null}
            {summary.rehabSetCount ? (
              <div>
                <dt className="text-xs text-muted-foreground">Rehab</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {summary.rehabExerciseCount} {summary.rehabExerciseCount === 1 ? "exercise" : "exercises"} · {summary.rehabSetCount}{" "}
                  {summary.rehabSetCount === 1 ? "set" : "sets"}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </header>

      {showDebug ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">Debug</summary>
          <div className="mt-2 space-y-1 text-xs font-mono text-muted-foreground">
            <div>session_id: {sessionId || "missing"}</div>
            <div>status: {status}</div>
          </div>
        </details>
      ) : null}

      <div className="mt-6">
        {loading ? (
          <div className="py-4 text-sm text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">Loading session…</div>
        ) : !sessionId ? (
          <div className="border-y border-border/60 py-4 text-sm text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">
            Missing session_id. Open a session from Training Log.
          </div>
        ) : !session ? (
          <div className="border-y border-border/60 py-4 text-sm text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">Session not found.</div>
        ) : sets.length === 0 ? (
          <div className="border-y border-border/60 py-4 text-sm text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">No sets found for this session.</div>
        ) : (
          <div className="divide-y divide-border/60 border-b border-border/60">
            {byExercise.map((block) => (
              <section key={block.key} className="py-6 first:pt-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">{block.exerciseName}</h2>
                    {block.role === "strength" || block.role === "mixed" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-blue-400">
                        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> Strength
                      </span>
                    ) : null}
                    {block.role === "rehab" || block.role === "mixed" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> Rehab
                      </span>
                    ) : null}
                  </div>
                  <div className="shrink-0 pt-0.5 text-xs text-muted-foreground">{block.rows.length} sets</div>
                </div>

                {block.role === "rehab" ? (
                  <p className="mt-1 text-xs text-muted-foreground">Rehab sets are excluded from strength totals.</p>
                ) : null}

                <div className="mt-3 divide-y divide-muted/20">
                  {block.rows.map((r) => (
                    <div key={r.training_set_log_id} className="py-3.5 text-sm">
                        {String(r.set_type || "straight").toLowerCase() === "drop" ? (() => {
                          const segs = segmentsBySet[r.training_set_log_id] || [];
                          const startSeg = segs[0] || null;
                          const startWeight = safeNum(startSeg?.weight, safeNum(r.weight, 0));
                          const startReps = safeNum(startSeg?.reps, safeNum(r.reps, 0));
                          const totalReps = segs.length
                            ? segs.reduce((sum, seg) => sum + safeNum(seg.reps, 0), 0)
                            : safeNum(r.reps, 0);

                          return (
                            <div className="grid grid-cols-[3.5rem_repeat(3,minmax(0,1fr))] items-end gap-x-3 sm:grid-cols-[4.5rem_repeat(3,minmax(0,1fr))]">
                              <div className="pb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Set {r.set_index}</div>
                              <div className="min-w-0">
                                <div className="text-xs text-muted-foreground">Start</div>
                                <div className="mt-0.5 font-medium tabular-nums">{startWeight} × {startReps}</div>
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs text-muted-foreground">Total reps</div>
                                <div className="mt-0.5 font-medium tabular-nums">{totalReps}</div>
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs text-muted-foreground">Volume</div>
                                <div className="mt-0.5 font-medium tabular-nums">{formatMetric(safeNum(r.volume, 0))}</div>
                              </div>
                            </div>
                          );
                        })() : (
                          <div className="grid grid-cols-[3.5rem_repeat(3,minmax(0,1fr))] items-end gap-x-3 sm:grid-cols-[4.5rem_repeat(3,minmax(0,1fr))]">
                            <div className="pb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Set {r.set_index}</div>
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground">Weight</div>
                              <div className="mt-0.5 font-medium tabular-nums">{safeNum(r.weight, 0)}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground">Reps</div>
                              <div className="mt-0.5 font-medium tabular-nums">{safeNum(r.reps, 0)}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground">Volume</div>
                              <div className="mt-0.5 font-medium tabular-nums">{formatMetric(safeNum(r.volume, 0))}</div>
                            </div>
                          </div>
                        )}

                        {String(r.set_type || "straight").toLowerCase() === "drop" ? (
                          <div className="mt-3 border-t border-border/40 pt-3">
                            <div className="mb-1 text-xs font-medium text-muted-foreground">Drop set detail</div>
                            {(segmentsBySet[r.training_set_log_id] || []).length ? (
                              <div className="divide-y divide-border/30">
                                {(segmentsBySet[r.training_set_log_id] || []).map((seg) => (
                                  <div
                                    key={`${r.training_set_log_id}:${seg.segment_index}`}
                                    className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-3 py-2 text-xs sm:grid-cols-[5rem_minmax(0,1fr)]"
                                  >
                                    <div className="pt-0.5 font-medium text-muted-foreground">
                                      {seg.label || (safeNum(seg.segment_index, 0) === 1 ? "Start" : `Drop ${safeNum(seg.segment_index, 1) - 1}`)}
                                    </div>
                                    <dl className="grid min-w-0 grid-cols-3 gap-x-3">
                                      <div className="min-w-0">
                                        <dt className="text-muted-foreground">Weight</dt>
                                        <dd className="mt-0.5 font-medium tabular-nums">{safeNum(seg.weight, 0)}</dd>
                                      </div>
                                      <div className="min-w-0">
                                        <dt className="text-muted-foreground">Reps</dt>
                                        <dd className="mt-0.5 font-medium tabular-nums">{safeNum(seg.reps, 0)}</dd>
                                      </div>
                                      <div className="min-w-0">
                                        <dt className="text-muted-foreground">Volume</dt>
                                        <dd className="mt-0.5 font-medium tabular-nums">{formatMetric(safeNum(seg.volume, 0))}</dd>
                                      </div>
                                    </dl>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">No drop segments found.</div>
                            )}
                          </div>
                        ) : null}

                      {r.flags || r.notes ? (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {r.flags ? <span>Flags: {r.flags}</span> : null}
                          {r.flags && r.notes ? <span> · </span> : null}
                          {r.notes ? <span>Notes: {r.notes}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
