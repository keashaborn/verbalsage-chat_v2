"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";

const WORKOUT_SET_VID = "1a2cad49-4972-43d7-9ba8-6031cd3c7657";
const SUBJECT_ID = "self";

type LibraryExercise = {
  id: string;
  label: string;
  planned_sets: number;
  default_weight: number;
  default_reps: number;
};

type LibraryWorkout = {
  id: string;
  label: string;
  exercises: LibraryExercise[];
};

type WorkoutLibrary = {
  workouts: LibraryWorkout[];
};

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

// Deterministic per-day ordering key (lexicographic ISO-ish string).
// idx=0 -> 08:00Z, idx=1 -> 08:01Z, etc.
function sortTsForDay(dateYYYYMMDD: string, idx: number) {
  const baseMinutes = 8 * 60;
  const minutes = baseMinutes + idx;
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${dateYYYYMMDD}T${pad2(hh)}:${pad2(mm)}:00Z`;
}

type PlannedWorkoutSetEntry = {
  date: string;
  workout: string;
  exercise: string;
  set_index: number;
  weight: number;
  reps: number;
  count: number;
  __vs_sort_ts: string;
  notes?: string;
  context?: string;
};

export default function LifeSwitchTrainingPage() {
  const [ownerUserId, setOwnerUserId] = React.useState<string>("");

  const [lib, setLib] = React.useState<WorkoutLibrary | null>(null);
  const [libStatus, setLibStatus] = React.useState<string>("loading…");

  const [workoutId, setWorkoutId] = React.useState<string>("");
  const [date, setDate] = React.useState<string>(todayLocalYYYYMMDD());
  const [context, setContext] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");

  const [preview, setPreview] = React.useState<PlannedWorkoutSetEntry[]>([]);
  const [posting, setPosting] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState<string>("");

  React.useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user?.id) throw new Error("not signed in");
        setOwnerUserId(data.user.id);
      } catch (e: any) {
        setOwnerUserId("");
        setStatus(`auth: ${e?.message || String(e)}`);
      }
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      setLibStatus("loading…");
      try {
        const r = await fetch("/api/lifeswitch/workout_library", { cache: "no-store" });
        const t = await r.text().catch(() => "");
        if (!r.ok) throw new Error(`workout_library failed: HTTP ${r.status} ${t}`);
        const j = JSON.parse(t) as WorkoutLibrary;
        if (!j || !Array.isArray(j.workouts)) throw new Error("invalid workout_library JSON (missing workouts[])");
        setLib(j);
        setLibStatus(`loaded (${j.workouts.length} workouts)`);
      } catch (e: any) {
        setLib(null);
        setLibStatus(`error: ${e?.message || String(e)}`);
      }
    })();
  }, []);

  const workouts = React.useMemo(() => {
    const ws = lib?.workouts || [];
    return ws.slice().sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }, [lib]);

  const selectedWorkout = React.useMemo(() => {
    if (!workoutId) return null;
    return (lib?.workouts || []).find((w) => w.id === workoutId) || null;
  }, [lib, workoutId]);

  function buildPlannedEntries(w: LibraryWorkout, dateYYYYMMDD: string): PlannedWorkoutSetEntry[] {
    const out: PlannedWorkoutSetEntry[] = [];
    let globalIdx = 0;

    for (const ex of Array.isArray(w.exercises) ? w.exercises : []) {
      const plannedSets = Math.max(0, Math.floor(Number(ex.planned_sets || 0)));
      const baseW = Number(ex.default_weight || 0);
      const baseR = Math.max(1, Math.floor(Number(ex.default_reps || 1)));

      for (let s = 1; s <= plannedSets; s++) {
        // Simple, deterministic “set progression” (you can change later):
        // +2.5 lbs each set, -1 rep each set (floor at 1)
        const weight = Number((baseW + (s - 1) * 2.5).toFixed(2));
        const reps = Math.max(1, baseR - (s - 1));
        const count = Number((weight * reps).toFixed(2));

        const row: PlannedWorkoutSetEntry = {
          date: dateYYYYMMDD,
          workout: w.label,
          exercise: ex.label,
          set_index: s,
          weight,
          reps,
          count,
          __vs_sort_ts: sortTsForDay(dateYYYYMMDD, globalIdx),
        };

        if (context.trim()) row.context = context.trim();
        if (notes.trim()) row.notes = notes.trim();

        out.push(row);
        globalIdx++;
      }
    }
    return out;
  }

  function doPreview() {
    setStatus("");
    if (!selectedWorkout) {
      setPreview([]);
      setStatus("select a workout");
      return;
    }
    if (!date.trim()) {
      setPreview([]);
      setStatus("date required");
      return;
    }
    const rows = buildPlannedEntries(selectedWorkout, date.trim());
    setPreview(rows);
    setStatus(`preview: ${rows.length} Workout Set rows`);
  }

  async function postSession() {
    setStatus("");
    if (!ownerUserId.trim()) {
      setStatus("auth: not signed in");
      return;
    }
    if (!selectedWorkout) {
      setStatus("select a workout");
      return;
    }
    if (!date.trim()) {
      setStatus("date required");
      return;
    }

    const rows = buildPlannedEntries(selectedWorkout, date.trim());
    setPreview(rows);

    if (rows.length === 0) {
      setStatus("nothing to post (0 planned rows)");
      return;
    }

    setPosting(true);
    try {
      let ok = 0;
      for (const row of rows) {
        const payload = {
          owner_user_id: ownerUserId.trim(),
          subject_id: SUBJECT_ID,
          template_version_id: WORKOUT_SET_VID,
          data: row,
        };

        const r = await fetch("/api/forms/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const t = await r.text().catch(() => "");
        if (!r.ok) throw new Error(`POST failed after ${ok} ok: HTTP ${r.status} ${t.slice(0, 1200)}`);
        ok += 1;
      }
      setStatus(`posted: ${rows.length}/${rows.length} Workout Set rows`);
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="text-xl font-semibold">LifeSwitch • Training</h1>

      <div className="mt-2 text-sm opacity-80">
        Workout library → generates <span className="font-mono">Workout Set</span> entries with deterministic{" "}
        <span className="font-mono">__vs_sort_ts</span> ordering for SSLG.
      </div>

      <div className="mt-4 rounded-xl border p-3">
        <div className="text-sm font-semibold">Status</div>
        <div className="mt-2 text-xs">
          <div>
            <span className="opacity-70">auth:</span>{" "}
            {ownerUserId ? <span className="font-mono">{ownerUserId}</span> : <span className="opacity-70">not signed in</span>}
          </div>
          <div>
            <span className="opacity-70">workout_library:</span> {libStatus}
          </div>
          {status ? <div className="mt-2 font-mono">{status}</div> : null}
        </div>
      </div>

      <div className="mt-4 rounded-xl border p-3">
        <div className="text-sm font-semibold">Create session</div>

        <div className="mt-3 grid gap-3">
          <label className="grid gap-1">
            <div className="text-xs opacity-70">Workout</div>
            <select
              className="rounded-md border px-2 py-1 text-sm"
              value={workoutId}
              onChange={(e) => setWorkoutId(e.target.value)}
              disabled={!lib || posting}
            >
              <option value="">Select…</option>
              {workouts.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <div className="text-xs opacity-70">Date</div>
            <input
              className="rounded-md border px-2 py-1 text-sm"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={posting}
            />
          </label>

          <label className="grid gap-1">
            <div className="text-xs opacity-70">Context (optional)</div>
            <input
              className="rounded-md border px-2 py-1 text-sm"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="gym / home / etc"
              disabled={posting}
            />
          </label>

          <label className="grid gap-1">
            <div className="text-xs opacity-70">Notes (optional)</div>
            <input
              className="rounded-md border px-2 py-1 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., plan / seed / template import"
              disabled={posting}
            />
          </label>

          <div className="flex gap-2">
            <button
              className="rounded-md border px-3 py-1 text-sm"
              onClick={doPreview}
              disabled={posting || !selectedWorkout || !date.trim()}
            >
              Preview
            </button>

            <button
              className="rounded-md bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
              onClick={postSession}
              disabled={posting || !ownerUserId.trim() || !selectedWorkout || !date.trim()}
              title={!ownerUserId.trim() ? "Sign in first" : ""}
            >
              {posting ? "Posting…" : "Post session"}
            </button>
          </div>

          <div className="text-xs opacity-70">
            Writes to <span className="font-mono">{WORKOUT_SET_VID}</span> (Workout Set template). Library stays static; this page
            fans out Workout Set rows from the selected workout definition.
          </div>
        </div>
      </div>

      {preview.length ? (
        <div className="mt-4 rounded-xl border p-3">
          <div className="text-sm font-semibold">Preview ({preview.length} rows)</div>
          <div className="mt-2 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left opacity-70">
                  <th className="py-1 pr-2">sort_ts</th>
                  <th className="py-1 pr-2">exercise</th>
                  <th className="py-1 pr-2">set</th>
                  <th className="py-1 pr-2">wt</th>
                  <th className="py-1 pr-2">reps</th>
                  <th className="py-1 pr-2">count</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 30).map((r, i) => (
                  <tr key={`${r.__vs_sort_ts}-${i}`} className="border-t">
                    <td className="py-1 pr-2 font-mono">{r.__vs_sort_ts}</td>
                    <td className="py-1 pr-2">{r.exercise}</td>
                    <td className="py-1 pr-2">{r.set_index}</td>
                    <td className="py-1 pr-2">{r.weight}</td>
                    <td className="py-1 pr-2">{r.reps}</td>
                    <td className="py-1 pr-2">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 30 ? <div className="mt-2 text-xs opacity-70">Showing first 30 rows.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
