"use client";

import { authFetch } from "@/lib/authFetch";
import { useConfirmAction } from "@/components/lifeswitch/ConfirmActionProvider";
import Link from "next/link";
import * as React from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";

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
  dose_type: string;
  dose_config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  prescription_name?: string | null;
};

type TrainingLogEvent =
  | { kind: "strength"; id: string; day: string; created_at: string; row: TrainingSessionRow }
  | { kind: "conditioning"; id: string; day: string; created_at: string; row: ConditioningSessionRow };

type MonthSection = {
  ym: string;
  label: string;
  sessions: TrainingSessionRow[];
  conditioningSessions: ConditioningSessionRow[];
  events: TrainingLogEvent[];
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

  return "unclassified";
}

function countsTowardStrength(row: TrainingSessionRow) {
  if (typeof row.counts_toward_strength === "boolean") {
    return row.counts_toward_strength;
  }
  const role = trainingSessionRole(row);
  return role === "strength" || role === "mixed";
}

function strengthMetric(row: TrainingSessionRow, summaryKey: "strength_set_count" | "strength_exercise_count" | "strength_volume", fallbackKey: "set_count" | "exercise_count" | "volume") {
  if (row[summaryKey] != null) return safeNum(row[summaryKey], 0);
  return countsTowardStrength(row) ? safeNum(row[fallbackKey], 0) : 0;
}
function doseValue(
  config: Record<string, unknown>,
  key: string
): string {
  const value = config?.[key];
  return value == null || value === "" ? "" : String(value);
}

function formatConditioningDose(
  row: ConditioningSessionRow
): string {
  const type = row.dose_type || "open";
  const config =
    row.dose_config &&
    typeof row.dose_config === "object" &&
    !Array.isArray(row.dose_config)
      ? row.dose_config
      : {};

  if (type === "loaded_carry") {
    const left = doseValue(config, "load_left");
    const right = doseValue(config, "load_right");
    const loadUnit = doseValue(config, "load_unit");
    const laps = doseValue(config, "laps");
    const distance = doseValue(config, "distance");
    const distanceUnit = doseValue(config, "distance_unit");
    const rounds = doseValue(config, "rounds");
    const rest = doseValue(config, "rest_seconds");

    return [
      left || right
        ? `${left || "—"} / ${right || "—"}${loadUnit ? ` ${loadUnit}` : ""}`
        : "",
      laps ? `${laps} ${laps === "1" ? "lap" : "laps"}` : "",
      distance
        ? `${distance}${distanceUnit ? ` ${distanceUnit}` : ""}`
        : "",
      rounds
        ? `${rounds} ${rounds === "1" ? "round" : "rounds"}`
        : "",
      rest && rest !== "0" ? `${rest} sec rest` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (type === "intervals") {
    const intervals = doseValue(config, "intervals");
    const work = doseValue(config, "work_seconds");
    const rest = doseValue(config, "rest_seconds");

    return [
      intervals
        ? `${intervals} ${intervals === "1" ? "interval" : "intervals"}`
        : "",
      work ? `${work} sec work` : "",
      rest && rest !== "0" ? `${rest} sec rest` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (type === "rounds") {
    const rounds = doseValue(config, "rounds");
    const work = doseValue(config, "work_seconds");
    const rest = doseValue(config, "rest_seconds");

    return [
      rounds
        ? `${rounds} ${rounds === "1" ? "round" : "rounds"}`
        : "",
      work ? `${work} sec work` : "",
      rest && rest !== "0" ? `${rest} sec rest` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (type === "distance") {
    const distance = doseValue(config, "distance");
    const unit = doseValue(config, "distance_unit");
    const time = doseValue(config, "target_time_min");
    const pace = doseValue(config, "target_pace");

    return [
      distance ? `${distance}${unit ? ` ${unit}` : ""}` : "",
      time ? `${time} min` : "",
      pace ? `${pace} pace` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (type === "laps") {
    const laps = doseValue(config, "laps");
    const perLap = doseValue(config, "distance_per_lap");
    const unit = doseValue(config, "distance_unit");

    return [
      laps ? `${laps} ${laps === "1" ? "lap" : "laps"}` : "",
      perLap
        ? `${perLap}${unit ? ` ${unit}` : ""} per lap`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (type === "repetitions") {
    const sets = doseValue(config, "sets");
    const reps = doseValue(config, "repetitions");

    return [
      sets ? `${sets} ${sets === "1" ? "set" : "sets"}` : "",
      reps ? `${reps} ${reps === "1" ? "rep" : "reps"}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (type === "open") {
    return doseValue(config, "description");
  }

  return "";
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

function MonthCalendar(props: {
  ym: string;
  workoutDates: Set<string>;
  conditioningDates: Set<string>;
  today: string;
}) {
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

      <div className="grid grid-cols-7 text-center">
        {cells.map((dayNum, idx) => {
          if (!dayNum) return <div key={`e-${idx}`} className="h-7" />;

          const date = `${ym}-${pad2(dayNum)}`;
          const didWorkout = workoutDates.has(date);
          const didConditioning = conditioningDates.has(date);
          const isToday = date === today;
          const state =
            didWorkout && didConditioning
              ? "both"
              : didWorkout
                ? "strength"
                : didConditioning
                  ? "conditioning"
                  : "none";
          const stateLabel = [
            didWorkout ? "strength" : "",
            didConditioning ? "conditioning" : "",
          ].filter(Boolean).join(" + ") || "no log";

          const markerCls = [
            "relative inline-flex h-7 min-w-7 items-center justify-center text-base transition-colors",
            state === "strength"
              ? "font-semibold text-emerald-700 dark:text-emerald-300"
              : "",
            state === "conditioning"
              ? "font-semibold text-amber-700 dark:text-amber-300"
              : "",
            state === "both"
              ? "font-semibold text-emerald-700 dark:text-emerald-300"
              : "",
            state === "none" ? "text-sm text-muted-foreground" : "",
            isToday ? "underline underline-offset-4" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={date}
              className="flex h-8 items-center justify-center"
              title={`${date}: ${stateLabel}`}
              aria-label={`${date}: ${stateLabel}`}
            >
              <span className={markerCls}>
                {dayNum}
                {state === "both" ? (
                  <span
                    className="absolute bottom-0 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-amber-600 dark:bg-amber-300"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrainingCalendarPage() {
  const confirmAction = useConfirmAction();
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
        `${readOnly ? "delegated read-only view · " : ""}loaded ${strengthArr.length} resistance sessions and ${conditioningArr.length} conditioning sessions`
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

    const confirmed = await confirmAction({
      title: `Remove ${name} from the log?`,
      description: "Its audit history will be preserved.",
      confirmLabel: "Remove session",
    });
    if (!confirmed) return;

    try {
      await fetchJson(`/api/lifeswitch/training/sessions/${encodeURIComponent(trainingSessionId)}/deactivate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "user_removed" }),
      });
      setOpenSessionActionsId("");
      await loadSessions();
    } catch (e: any) {
      setStatus(`remove failed: ${String(e?.message || e)}`);
    }
  }

  async function deleteConditioningSession(
    conditioningSessionId: string,
    name: string,
  ) {
    if (readOnly) {
      setStatus("delegated read-only view: delete is not allowed");
      return;
    }

    const confirmed = await confirmAction({
      title: `Remove ${name} from the log?`,
      description: "Its audit history will be preserved.",
      confirmLabel: "Remove session",
    });
    if (!confirmed) return;

    try {
      await fetchJson(
        `/api/lifeswitch/training/conditioning_sessions/${encodeURIComponent(
          conditioningSessionId,
        )}/deactivate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "user_removed" }),
        },
      );
      setOpenSessionActionsId("");
      await loadSessions();
    } catch (e: any) {
      setStatus(`remove failed: ${String(e?.message || e)}`);
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

      const strengthSessions = ss.filter(countsTowardStrength);
      const workoutDates = new Set<string>(
        strengthSessions.map((x) => String(x.day || "")),
      );
      const conditioningDates = new Set<string>(cc.map((x) => String(x.day || "")));
      const volume = ss.reduce(
        (acc, x) => acc + strengthMetric(x, "strength_volume", "volume"),
        0,
      );
      const sets = ss.reduce(
        (acc, x) => acc + strengthMetric(x, "strength_set_count", "set_count"),
        0,
      );
      const conditioningMinutes = cc.reduce((acc, x) => acc + safeNum(x.duration_min, 0), 0);

      const events: TrainingLogEvent[] = [
        ...ss.map((row) => ({
          kind: "strength" as const,
          id: row.training_session_id,
          day: String(row.day || ""),
          created_at: String(row.created_at || ""),
          row,
        })),
        ...cc.map((row) => ({
          kind: "conditioning" as const,
          id: row.conditioning_session_log_id,
          day: String(row.day || ""),
          created_at: String(row.created_at || ""),
          row,
        })),
      ].sort((a, b) => {
        const d = String(b.day || "").localeCompare(String(a.day || ""));
        if (d !== 0) return d;
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });

      out.push({
        ym,
        label: monthLabel(ym),
        sessions: ss,
        conditioningSessions: cc,
        events,
        workoutDates,
        conditioningDates,
        workouts: strengthSessions.length,
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
          <h1 className="text-xl font-semibold">Training · Log</h1>
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
          onClick={() => void loadSessions()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="mt-4 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Training days</div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-medium text-emerald-700 dark:text-emerald-300">
            Strength
          </span>
          <span className="font-medium text-amber-700 dark:text-amber-300">
            Conditioning
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="relative font-medium text-emerald-700 dark:text-emerald-300">
              Both
              <span
                className="absolute -bottom-1 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-amber-600 dark:bg-amber-300"
                aria-hidden="true"
              />
            </span>
          </span>
          <span>No log</span>
        </div>
      </div>

      {showDebug ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground">Debug</summary>
          <div className="mt-2 space-y-1 text-xs font-mono text-muted-foreground">
            <div>status: {status}</div>
            <div>resistance sessions: {sessions.length}</div>
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

              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_3.75rem] items-start gap-2 sm:block">
                <div className="order-2 grid gap-y-2 border-l border-border/50 pl-2 sm:order-none sm:grid-cols-5 sm:gap-x-4 sm:border-x-0 sm:border-y sm:py-3 sm:pl-0">
                  {[
                    { label: "Workouts", value: m.workouts },
                    { label: "Volume", value: formatK(m.volume) },
                    { label: "Sets", value: m.sets },
                    { label: "Conditioning", value: m.conditioning },
                    {
                      label: "Time",
                      value:
                        m.conditioningMinutes >= 60
                          ? `${String(Math.round((m.conditioningMinutes / 60) * 10) / 10).replace(/\.0$/, "")}h`
                          : `${Math.round(m.conditioningMinutes)}m`,
                    },
                  ].map((metric) => (
                    <div key={metric.label}>
                      <div className="text-sm font-semibold leading-none sm:text-base">
                        {metric.value}
                      </div>
                      <div className="mt-0.5 text-[8px] leading-tight tracking-wide text-muted-foreground uppercase sm:mt-1 sm:text-[10px]">
                        {metric.label}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="order-1 min-w-0 sm:order-none sm:mt-4">
                  <MonthCalendar
                    ym={m.ym}
                    workoutDates={m.workoutDates}
                    conditioningDates={m.conditioningDates}
                    today={today}
                  />
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Sessions</div>
                  <div className="text-xs text-muted-foreground">
                    {m.events.length} {m.events.length === 1 ? "session" : "sessions"}
                  </div>
                </div>
                <div className="mt-2 divide-y divide-border/50 border-y border-border/50">
                  {m.events.map((event) => {
                  if (event.kind === "strength") {
                    const s = event.row;
                    const role = trainingSessionRole(s);
                    const strengthExercises = strengthMetric(
                      s,
                      "strength_exercise_count",
                      "exercise_count",
                    );
                    const strengthSets = strengthMetric(
                      s,
                      "strength_set_count",
                      "set_count",
                    );
                    const strengthVolume = strengthMetric(
                      s,
                      "strength_volume",
                      "volume",
                    );
                    const rehabExercises = safeNum(
                      s.rehab_exercise_count,
                      role === "rehab" ? safeNum(s.exercise_count, 0) : 0,
                    );
                    const rehabSets = safeNum(
                      s.rehab_set_count,
                      role === "rehab" ? safeNum(s.set_count, 0) : 0,
                    );
                    const sessionHref = `/lifeswitch/training/session?session_id=${encodeURIComponent(s.training_session_id)}${targetUserId ? `&target_user_id=${encodeURIComponent(targetUserId)}&target_name=${encodeURIComponent(targetName)}` : ""}`;
                    const actionsOpen = openSessionActionsId === s.training_session_id;
                    const actionsId = `session-actions-${s.training_session_id}`;

                    return (
                      <article
                        key={`strength:${s.training_session_id}`}
                        className="py-4 transition-colors hover:bg-muted/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-semibold">{s.name}</div>
                              {role === "strength" || role === "mixed" ? (
                                <span className="text-[10px] font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
                                  Strength
                                </span>
                              ) : null}
                              {role === "rehab" || role === "mixed" ? (
                                <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                                  Rehab
                                </span>
                              ) : null}
                              {role === "unclassified" ? (
                                <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                                  Unclassified
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {role === "rehab" ? (
                                <>
                                  {s.day} · {rehabExercises} rehab exercises · {rehabSets} rehab sets
                                </>
                              ) : role === "unclassified" ? (
                                <>
                                  {s.day} · {safeNum(s.exercise_count, 0)} exercises · {safeNum(s.set_count, 0)} sets
                                </>
                              ) : (
                                <>
                                  {s.day} · {strengthExercises} strength exercises · {strengthSets} strength sets · volume{" "}
                                  {formatK(strengthVolume)}
                                  {role === "mixed" ? ` · ${rehabSets} rehab sets` : ""}
                                </>
                              )}
                            </div>
                            {s.notes ? <div className="mt-2 text-xs text-muted-foreground">{s.notes}</div> : null}
                          </div>

                          {!readOnly ? (
                            <div className="relative shrink-0">
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => {
                                  setOpenSessionActionsId((prev) =>
                                    prev === s.training_session_id ? "" : s.training_session_id
                                  );
                                }}
                                aria-expanded={actionsOpen}
                                aria-controls={actionsId}
                                aria-haspopup="menu"
                                aria-label={`Actions for ${s.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>

                              {actionsOpen ? (
                                <div
                                  id={actionsId}
                                  role="menu"
                                  className="absolute right-0 top-9 z-20 w-32 rounded-lg border bg-popover p-1 text-sm shadow-lg"
                                >
                                  <Link
                                    href={sessionHref}
                                    role="menuitem"
                                    className="flex w-full items-center rounded-md px-2 py-1.5 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    aria-label={`View ${s.name} session`}
                                  >
                                    View
                                  </Link>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-red-600 hover:bg-red-500/10"
                                    onClick={() => {
                                      void deleteSession(
                                        s.training_session_id,
                                        s.name,
                                      );
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <Link
                              href={sessionHref}
                              className="inline-flex min-h-8 shrink-0 items-center rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`View ${s.name} session`}
                            >
                              View
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  }

                  const c = event.row;
                  const detailParts = [
                    c.day,
                    safeNum(c.duration_min, 0) ? `${safeNum(c.duration_min, 0)} min` : null,
                    c.distance || null,
                    c.intensity || null,
                  ].filter(Boolean);
                  const conditioningActionsKey =
                    `conditioning:${c.conditioning_session_log_id}`;
                  const conditioningActionsOpen =
                    openSessionActionsId === conditioningActionsKey;
                  const conditioningActionsId =
                    `conditioning-actions-${c.conditioning_session_log_id}`;

                  return (
                    <article
                      key={`conditioning:${c.conditioning_session_log_id}`}
                      className="py-4 transition-colors hover:bg-muted/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-semibold">{c.name}</div>
                            <span className="text-[10px] font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">
                              Conditioning
                            </span>
                          </div>

                          <div className="mt-1 text-xs text-muted-foreground">
                            {detailParts.join(" · ")}
                          </div>

                          {formatConditioningDose(c) ? (
                            <div className="mt-2 text-xs font-medium text-blue-400">
                              {formatConditioningDose(c)}
                            </div>
                          ) : null}

                          {c.notes ? <div className="mt-2 text-xs text-muted-foreground">{c.notes}</div> : null}
                        </div>

                        {!readOnly ? (
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() =>
                                setOpenSessionActionsId((previous) =>
                                  previous === conditioningActionsKey
                                    ? ""
                                    : conditioningActionsKey,
                                )
                              }
                              aria-expanded={conditioningActionsOpen}
                              aria-controls={conditioningActionsId}
                              aria-haspopup="menu"
                              aria-label={`Actions for ${c.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>

                            {conditioningActionsOpen ? (
                              <div
                                id={conditioningActionsId}
                                role="menu"
                                className="absolute right-0 top-9 z-20 w-32 rounded-lg border bg-popover p-1 text-sm shadow-lg"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-red-600 hover:bg-red-500/10"
                                  onClick={() =>
                                    void deleteConditioningSession(
                                      c.conditioning_session_log_id,
                                      c.name,
                                    )
                                  }
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                  })}
                </div>
              </div>
            </section>
          ))
        ) : (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            No training sessions yet. Finish a workout from Capture and it will appear here.
          </div>
        )}
      </div>
    </div>
  );
}
