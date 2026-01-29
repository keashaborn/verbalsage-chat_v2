"use client";

import * as React from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const WORKOUT_SET_VID = "1a2cad49-4972-43d7-9ba8-6031cd3c7657";

type WorkoutSetData = {
  date: string; // YYYY-MM-DD
  workout: string;
  exercise: string;
  set_index: number;
  weight: number;
  reps: number;
  count: number;
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

export default function TrainingCalendarPage() {
  const [ownerUserId, setOwnerUserId] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("auth: loading…");
  const [rows, setRows] = React.useState<FormsEntry[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setStatus("auth: loading…");

      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user?.id) {
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
        u.searchParams.set("limit", "2000"); // client-side filter for now

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
      // sort sets by deterministic per-day key (fallback to occurred_at)
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
        exercises_preview: exercises.slice(0, 4),
      });
    }

    // newest date first, then workout name
    out.sort((a, b) => {
      const c = String(b.date).localeCompare(String(a.date));
      if (c !== 0) return c;
      return String(a.workout).localeCompare(String(b.workout));
    });

    return out;
  }, [rows]);

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-3 flex justify-end">
        <Link href="/lifeswitch" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30">
          Back
        </Link>
      </div>

      <div className="text-lg font-semibold">Training · Calendar</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Log feed (MVP). Next: month calendar strip + stats + click-through session detail + repeat.
      </div>

      <div className="mt-4 rounded-xl border p-3 text-xs">
        <div className="opacity-70">auth:</div>
        <div className="font-mono">{ownerUserId ? ownerUserId : "not signed in"}</div>
        <div className="mt-2 opacity-70">status:</div>
        <div className="font-mono">{status}</div>
        <div className="mt-2 opacity-70">sessions:</div>
        <div className="font-mono">{sessions.length}</div>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">Loading…</div>
        ) : sessions.length ? (
          sessions.map((s) => (
            <div key={s.key} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{s.workout}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {s.date} · sets={s.set_count} · exercises={s.exercise_count} · volume={s.volume}
                  </div>
                  {s.exercises_preview.length ? (
                    <div className="mt-2 text-xs opacity-80">
                      {s.exercises_preview.join(" · ")}
                      {s.exercise_count > s.exercises_preview.length ? " …" : ""}
                    </div>
                  ) : null}
                </div>

                {/* later: link to /lifeswitch/training/session?... */}
                <button className="shrink-0 rounded-md border px-3 py-1.5 text-xs opacity-60" disabled>
                  Open
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            No sessions found yet (0 rows). Post a session first.
          </div>
        )}
      </div>
    </div>
  );
}
