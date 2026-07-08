"use client";

import { authFetch } from "@/lib/authFetch";
import Link from "next/link";
import ConditioningLogSection from "@/components/lifeswitch/training/ConditioningLogSection";
import * as React from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

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

type MonthSection = {
  ym: string;
  label: string;
  sessions: TrainingSessionRow[];
  conditioningSessions: ConditioningSessionRow[];
  workoutDates: Set<string>;
  conditioningDates: Set<string>;
  workouts: number;
  conditioning: number;
  conditioningMinutes: number;
  volume: number;
  sets: number;
};

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function todayLocalYYYYMMDD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function monthLabel(ym: string) {
  const m = String(ym || "").trim();
  const mm = m.match(/^(\d{4})-(\d{2})$/);
  if (!mm) return m || "Unknown month";
  const year = Number(mm[1]);
  const month1 = Number(mm[2]);
  const name = MONTHS[Math.max(1, Math.min(12, month1)) - 1] || "Unknown";
  return `${name}, ${year}`;
}

function daysInMonthUTC(year: number, month1: number) {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function firstDowUTC(year: number, month1: number) {
  return new Date(Date.UTC(year, month1 - 1, 1)).getUTCDay();
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

function MonthCalendar(props: { ym: string; workoutDates: Set<string>; conditioningDates: Set<string>; today: string }) {
  const { ym, workoutDates, conditioningDates, today } = props;

  const mm = String(ym || "").trim().match(/^(\d{4})-(\d{2})$/);
  if (!mm) return null;

  const year = Number(mm[1]);
  const month1 = Number(mm[2]);
  const dim = daysInMonthUTC(year, month1);
  const firstDow = firstDowUTC(year, month1);

  const totalCells = Math.ceil((firstDow + dim) / 7) * 7;
  const cells: Array<number | null> = [];

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDow + 1;
    cells.push(dayNum >= 1 && dayNum <= dim ? dayNum : null);
  }

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-7 text-center text-[11px] opacity-70">
        {DOW.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 text-center text-sm">
        {cells.map((dayNum, idx) => {
          if (!dayNum) return <div key={`e-${idx}`} className="h-7" />;

          const date = `${ym}-${pad2(dayNum)}`;
          const didWorkout = workoutDates.has(date);
          const didConditioning = conditioningDates.has(date);
          const isToday = date === today;
          const state =
            didWorkout && didConditioning ? "both" : didWorkout ? "strength" : didConditioning ? "conditioning" : "none";

          const cls = [
            "h-7 flex items-center justify-center rounded-md border transition-colors",
            state === "strength" ? "border-blue-500/80 bg-blue-500/10 text-blue-900 dark:text-blue-100 font-semibold" : "",
            state === "conditioning" ? "border-yellow-400/80 bg-yellow-500/20 text-yellow-100 font-semibold" : "",
            state === "both" ? "border-green-700/80 bg-green-500/30 text-green-950 dark:border-green-400/80 dark:bg-green-500/20 dark:text-green-100 font-semibold" : "",
            state === "none" ? "border-muted/40 text-muted-foreground" : "",
            isToday ? "underline underline-offset-4" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={date} className={cls} title={`${date}: ${state}`}>
              {dayNum}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrainingCalendarPage() {
  const [status, setStatus] = React.useState("loading sessions...");
  const [openSessionActionsId, setOpenSessionActionsId] = React.useState("");
  const [sessions, setSessions] = React.useState<TrainingSessionRow[]>([]);
  const [conditioningSessions, setConditioningSessions] = React.useState<ConditioningSessionRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const searchParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();

  const targetUserId = String(searchParams.get("target_user_id") || "").trim();
  const targetName = String(searchParams.get("target_name") || "").trim();
  const readOnly = Boolean(targetUserId);
  const showDebug = String(searchParams.get("debug") || "") === "1";

  const today = React.useMemo(() => todayLocalYYYYMMDD(), []);

  async function loadSessions() {
    setLoading(true);
    setStatus("loading training sessions...");

    try {
      const targetParam = targetUserId ? `&target_user_id=${encodeURIComponent(targetUserId)}` : "";

      const [strengthJson, conditioningJson] = await Promise.all([
        fetchJson(`/api/lifeswitch/training/sessions?limit=250${targetParam}`),
        fetchJson(`/api/lifeswitch/training/conditioning_sessions?limit=250${targetParam}`),
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

      setSessions(strengthArr);
      setConditioningSessions(conditioningArr);
      setStatus(
        `${readOnly ? "delegated read-only view · " : ""}loaded ${strengthArr.length} strength sessions and ${conditioningArr.length} conditioning sessions`
      );
    } catch (e: any) {
      setSessions([]);
      setConditioningSessions([]);
      setStatus(`error: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  async function deleteSession(trainingSessionId: string, name: string) {
    if (readOnly) {
      setStatus("delegated read-only view: delete is not allowed");
      return;
    }

    const ok = window.confirm(`Delete logged session "${name}"?`);
    if (!ok) return;

    try {
      await fetchJson(`/api/lifeswitch/training/sessions/${encodeURIComponent(trainingSessionId)}/deactivate`, {
        method: "POST",
      });
      setOpenSessionActionsId("");
      await loadSessions();
    } catch (e: any) {
      setStatus(`delete failed: ${String(e?.message || e)}`);
    }
  }

  const months = React.useMemo(() => {
    const strengthByMonth = new Map<string, TrainingSessionRow[]>();
    const conditioningByMonth = new Map<string, ConditioningSessionRow[]>();

    for (const s of sessions) {
      const ym = String(s?.day || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;

      const arr = strengthByMonth.get(ym) || [];
      arr.push(s);
      strengthByMonth.set(ym, arr);
    }

    for (const c of conditioningSessions) {
      const ym = String(c?.day || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;

      const arr = conditioningByMonth.get(ym) || [];
      arr.push(c);
      conditioningByMonth.set(ym, arr);
    }

    const monthKeys = new Set<string>([
      ...Array.from(strengthByMonth.keys()),
      ...Array.from(conditioningByMonth.keys()),
    ]);

    const out: MonthSection[] = [];

    for (const ym of monthKeys) {
      const ss = strengthByMonth.get(ym) || [];
      const cc = conditioningByMonth.get(ym) || [];

      ss.sort((a, b) => {
        const c = String(b.day || "").localeCompare(String(a.day || ""));
        if (c !== 0) return c;
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });

      cc.sort((a, b) => {
        const c = String(b.day || "").localeCompare(String(a.day || ""));
        if (c !== 0) return c;
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });

      const workoutDates = new Set<string>(ss.map((x) => String(x.day || "")));
      const conditioningDates = new Set<string>(cc.map((x) => String(x.day || "")));
      const volume = ss.reduce((acc, x) => acc + safeNum(x.volume, 0), 0);
      const sets = ss.reduce((acc, x) => acc + safeNum(x.set_count, 0), 0);
      const conditioningMinutes = cc.reduce((acc, x) => acc + safeNum(x.duration_min, 0), 0);

      out.push({
        ym,
        label: monthLabel(ym),
        sessions: ss,
        conditioningSessions: cc,
        workoutDates,
        conditioningDates,
        workouts: ss.length,
        conditioning: cc.length,
        conditioningMinutes,
        volume,
        sets,
      });
    }

    out.sort((a, b) => String(b.ym).localeCompare(String(a.ym)));
    return out;
  }, [sessions, conditioningSessions]);

  return (
    <div className="mx-auto max-w-5xl p-4">
      {readOnly ? (
        <div className="mb-4 rounded-xl border bg-muted/20 p-3 text-sm">
          You are viewing {targetName ? `${targetName}’s` : "another person’s"} training log. This delegated view is read-only.
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Training · Log</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Review completed strength and conditioning sessions from Training Capture.
          </div>
        </div>

        <button
          type="button"
          className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30"
          onClick={() => void loadSessions()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="mt-4 rounded-xl border bg-muted/10 p-3 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Training days</div>
        <div className="mt-1">
          Strength and conditioning are tracked separately. A green day means both were logged.
        </div>
        <div className="mt-2 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border border-blue-500/80 bg-blue-500/10" />
            Strength
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border border-yellow-400/80 bg-yellow-500/20" />
            Conditioning
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border border-green-500/80 bg-green-500/20" />
            Both
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border border-muted/40" />
            No log
          </span>
        </div>
      </div>

      {showDebug ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground">Debug</summary>
          <div className="mt-2 space-y-1 text-xs font-mono text-muted-foreground">
            <div>status: {status}</div>
            <div>strength sessions: {sessions.length}</div>
            <div>conditioning sessions: {conditioningSessions.length}</div>
            <div>months: {months.length}</div>
          </div>
        </details>
      ) : null}


      <div className="mt-8">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : months.length ? (
          months.map((m, idx) => (
            <section key={m.ym} className={idx ? "mt-10 border-t border-muted/20 pt-10" : ""}>
              <div className="text-base font-semibold">{m.label}</div>

              <div className="mt-4 grid grid-cols-[1fr_6.5rem] items-start gap-2">
                <MonthCalendar ym={m.ym} workoutDates={m.workoutDates} conditioningDates={m.conditioningDates} today={today} />

                <div className="flex justify-center">
                  <div className="w-[6.25rem] rounded-xl border border-muted/20 px-2 py-2 text-center">
                    <div className="text-sm font-semibold leading-none">{m.workouts}</div>
                    <div className="mt-0.5 text-[9px] tracking-wide opacity-70">WORKOUTS</div>

                    <div className="mt-2 text-sm font-semibold leading-none">{formatK(m.volume)}</div>
                    <div className="mt-0.5 text-[9px] tracking-wide opacity-70">VOLUME</div>

                    <div className="mt-2 text-sm font-semibold leading-none">{m.sets}</div>
                    <div className="mt-0.5 text-[9px] tracking-wide opacity-70">SETS</div>

                      <div className="mt-2 text-sm font-semibold leading-none">{m.conditioning}</div>
                      <div className="mt-0.5 text-[9px] tracking-wide opacity-70">COND</div>

                      <div className="mt-2 text-sm font-semibold leading-none">
                        {m.conditioningMinutes >= 60
                          ? `${String(Math.round((m.conditioningMinutes / 60) * 10) / 10).replace(/\.0$/, "")}h`
                          : `${Math.round(m.conditioningMinutes)}m`}
                      </div>
                      <div className="mt-0.5 text-[9px] tracking-wide opacity-70">TIME</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {m.sessions.map((s) => (
                  <Link
                    key={s.training_session_id}
                    href={`/lifeswitch/training/session?session_id=${encodeURIComponent(s.training_session_id)}${targetUserId ? `&target_user_id=${encodeURIComponent(targetUserId)}&target_name=${encodeURIComponent(targetName)}` : ""}`}
                    className="block rounded-xl border p-4 hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{s.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {s.day} · {safeNum(s.exercise_count, 0)} exercises · {safeNum(s.set_count, 0)} sets · volume{" "}
                          {formatK(safeNum(s.volume, 0))}
                        </div>
                        {s.notes ? <div className="mt-2 text-xs text-muted-foreground">{s.notes}</div> : null}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2 text-xs">
                        <span className="text-muted-foreground">View</span>
                        {!readOnly ? (
                          <>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-muted-foreground hover:bg-muted/30"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenSessionActionsId((prev) =>
                                  prev === s.training_session_id ? "" : s.training_session_id
                                );
                              }}
                              aria-expanded={openSessionActionsId === s.training_session_id}
                            >
                              Actions
                              {openSessionActionsId === s.training_session_id ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>

                            {openSessionActionsId === s.training_session_id ? (
                              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-red-500">
                                  Danger zone
                                </div>
                                <button
                                  type="button"
                                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-[11px] text-red-600 hover:bg-red-500/10"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void deleteSession(s.training_session_id, s.name);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete session
                                </button>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            No training sessions yet. Finish a workout from Capture and it will appear here.
          </div>
        )}
      </div>

        <ConditioningLogSection targetUserId={targetUserId} readOnly={readOnly} />
    </div>
  );
}
