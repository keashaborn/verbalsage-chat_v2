"use client";

import * as React from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const WORKOUT_SET_VID = "1a2cad49-4972-43d7-9ba8-6031cd3c7657";

type WorkoutSetData = {
  date: string; // YYYY-MM-DD (user local date when created)
  workout: string;
  exercise: string;
  set_index: number;
  weight: number;
  reps: number;
  count: number; // weight*reps (your “volume” unit)
  __vs_sort_ts: string;
};

type FormsEntry = {
  id: string;
  owner_user_id: string;
  subject_id: string;
  template_version_id: string;
  occurred_at: string;
  data: WorkoutSetData;
};

type Session = {
  key: string; // `${date}||${workout}`
  date: string;
  workout: string;
  sets: FormsEntry[];
  set_count: number;
  exercise_count: number;
  volume: number; // sum(count)
  exercises_preview: string[];
};

type MonthSection = {
  ym: string; // YYYY-MM
  label: string; // e.g. "January, 2026"
  sessions: Session[];
  workoutDates: Set<string>; // YYYY-MM-DD for bolding days
  workouts: number; // session count
  volume: number; // sum(session.volume)
  time_seconds: number | null; // TBD (need duration capture)
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
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function uniqPreserveOrder(xs: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const k = String(x || "").trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
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
  // month1 = 1..12
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function firstDowUTC(year: number, month1: number) {
  // 0=Sun ... 6=Sat
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

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MonthCalendar(props: { ym: string; workoutDates: Set<string>; today: string }) {
  const { ym, workoutDates, today } = props;

  const mm = String(ym || "").trim().match(/^(\d{4})-(\d{2})$/);
  if (!mm) return null;

  const year = Number(mm[1]);
  const month1 = Number(mm[2]);
  const dim = daysInMonthUTC(year, month1);
  const firstDow = firstDowUTC(year, month1);

  const totalCells = Math.ceil((firstDow + dim) / 7) * 7; // 35 or 42
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
          if (!dayNum) {
            return <div key={`e-${idx}`} className="h-7" />;
          }

          const date = `${ym}-${pad2(dayNum)}`;
          const didWorkout = workoutDates.has(date);
          const isToday = date === today;

          const cls = [
            "h-7 flex items-center justify-center",
            didWorkout ? "font-semibold" : "opacity-60",
            isToday ? "underline underline-offset-4" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={date} className={cls}>
              {dayNum}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrainingCalendarPage() {
  const [ownerUserId, setOwnerUserId] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("auth: loading…");
  const [rows, setRows] = React.useState<FormsEntry[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  const today = React.useMemo(() => todayLocalYYYYMMDD(), []);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setStatus("auth: loading…");

      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user?.id) {
          if (cancelled) return;
          setOwnerUserId("");
          setRows([]);
          setStatus("auth: not signed in");
          return;
        }

        const uid = data.user.id;
        if (cancelled) return;
        setOwnerUserId(uid);

        setStatus("loading workout sets…");

        const u = new URL("/api/forms/entries/list", window.location.origin);
        u.searchParams.set("owner_user_id", uid);
        u.searchParams.set("template_version_id", WORKOUT_SET_VID);
        u.searchParams.set("limit", "5000"); // MVP; paginate later

        const r = await fetch(u.toString(), { cache: "no-store" });
        const t = await r.text().catch(() => "");
        if (!r.ok) throw new Error(`entries/list failed: HTTP ${r.status} ${t.slice(0, 400)}`);

        const j = JSON.parse(t);
        const next = Array.isArray(j) ? (j as FormsEntry[]) : [];

        if (cancelled) return;
        setRows(next);
        setStatus(`loaded ${next.length} sets`);
      } catch (e: any) {
        if (cancelled) return;
        setRows([]);
        setStatus(`error: ${e?.message || String(e)}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const sessions = React.useMemo(() => {
    const byKey = new Map<string, FormsEntry[]>();

    for (const r of rows) {
      const d = r?.data;
      const date = String(d?.date || "").trim();
      const workout = String(d?.workout || "").trim();
      if (!date || !workout) continue;

      const key = `${date}||${workout}`;
      const arr = byKey.get(key) || [];
      arr.push(r);
      byKey.set(key, arr);
    }

    const out: Session[] = [];
    for (const [key, sets] of byKey.entries()) {
      sets.sort((a, b) => {
        const sa = String(a?.data?.__vs_sort_ts || a?.occurred_at || "");
        const sb = String(b?.data?.__vs_sort_ts || b?.occurred_at || "");
        return sa.localeCompare(sb);
      });

      const first = sets[0];
      const date = String(first?.data?.date || "");
      const workout = String(first?.data?.workout || "");

      const vol = sets.reduce((acc, x) => acc + safeNum(x?.data?.count, 0), 0);
      const exercises = uniqPreserveOrder(sets.map((x) => String(x?.data?.exercise || "")));

      out.push({
        key,
        date,
        workout,
        sets,
        set_count: sets.length,
        exercise_count: exercises.length,
        volume: Number(vol.toFixed(2)),
        exercises_preview: exercises.slice(0, 6),
      });
    }

    out.sort((a, b) => {
      const c = String(b.date).localeCompare(String(a.date));
      if (c !== 0) return c;
      return String(a.workout).localeCompare(String(b.workout));
    });

    return out;
  }, [rows]);

  const months = React.useMemo(() => {
    const byMonth = new Map<string, Session[]>();
    for (const s of sessions) {
      const ym = String(s?.date || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      const arr = byMonth.get(ym) || [];
      arr.push(s);
      byMonth.set(ym, arr);
    }

    const out: MonthSection[] = [];
    for (const [ym, ss] of byMonth.entries()) {
      ss.sort((a, b) => {
        const c = String(b.date).localeCompare(String(a.date));
        if (c !== 0) return c;
        return String(a.workout).localeCompare(String(b.workout));
      });

      const workoutDates = new Set<string>(ss.map((x) => x.date));
      const vol = ss.reduce((acc, x) => acc + safeNum(x.volume, 0), 0);

      out.push({
        ym,
        label: monthLabel(ym),
        sessions: ss,
        workoutDates,
        workouts: ss.length,
        volume: Number(vol.toFixed(2)),
        time_seconds: null, // needs duration capture
      });
    }

    out.sort((a, b) => String(b.ym).localeCompare(String(a.ym)));
    return out;
  }, [sessions]);

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="text-lg font-semibold">Training · Calendar</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Month calendar + monthly totals, then session feed. Next: click-through session detail + repeat.
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted-foreground">Debug</summary>
        <div className="mt-2 space-y-1 text-xs font-mono text-muted-foreground">
          <div>auth: {ownerUserId ? ownerUserId : "not signed in"}</div>
          <div>status: {status}</div>
          <div>sets: {rows.length}</div>
          <div>sessions: {sessions.length}</div>
          <div>months: {months.length}</div>
        </div>
      </details>

      <div className="mt-8">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : months.length ? (
          months.map((m, idx) => (
            <section key={m.ym} className={idx ? "mt-10 pt-10 border-t border-muted/20" : ""}>
              <div className="text-base font-semibold">{m.label}</div>

              <div className="mt-4 grid grid-cols-[1fr_7.25rem] gap-3 items-start">
                <MonthCalendar ym={m.ym} workoutDates={m.workoutDates} today={today} />

                <div className="rounded-lg border border-muted/20 p-3 justify-self-center self-center text-center w-[7.25rem]">
                  <div className="text-xl font-semibold">{m.workouts}</div>
                  <div className="text-xs opacity-70">WORKOUTS</div>

                  <div className="mt-4 text-xl font-semibold">{formatK(m.volume)}</div>
                  <div className="text-xs opacity-70">VOLUME</div>

                  <div className="mt-4 text-xl font-semibold">{formatDuration(m.time_seconds)}</div>
                  <div className="text-xs opacity-70">TIME</div>
                </div>
              </div>

              <div className="mt-8">
                {m.sessions.map((s, sidx) => {
                  const href =
                    "/lifeswitch/training/session?date=" +
                    encodeURIComponent(s.date) +
                    "&workout=" +
                    encodeURIComponent(s.workout);

                  return (
                    <Link
                      key={s.key}
                      href={href}
                      className={[
                        "block",
                        sidx ? "mt-8 pt-8 border-t border-muted/20" : "",
                        // minimalist affordances: no box, just subtle hover + focus ring
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className="text-lg font-semibold hover:underline underline-offset-4">
                        {s.workout}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {s.date} · sets={s.set_count} · exercises={s.exercise_count} · volume={s.volume}
                      </div>
                      {s.exercises_preview.length ? (
                        <div className="mt-2 text-sm opacity-80">
                          {s.exercises_preview.join(" · ")}
                          {s.exercise_count > s.exercises_preview.length ? " …" : ""}
                        </div>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">No sessions found yet. Post a session first.</div>
        )}
      </div>
    </div>
  );
}
