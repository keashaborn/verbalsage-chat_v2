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

type ExerciseSearchHit = {
  exercise_id: string;
  display_name: string;
  kind: string;
  modality: string;
  score?: number;
  matched_text?: string | null;
  matched_source?: string | null;
  brand_name?: string | null;
  model_name?: string | null;
};

type MyExercise = {
  exercise_id: string;
  display_name: string;
  kind: string;
  modality: string;
  brand_name?: string | null;
  model_name?: string | null;
  // Keep what the user typed / what matched for traceability
  matched_text?: string | null;
  matched_source?: string | null;
};

const LS_MY_EXERCISES_KEY = "lifeswitch_my_exercises_v0";

function lsGet<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    if (!v) return fallback;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function lsSet(k: string, v: any) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // ignore
  }
}

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
  // DB-backed exercise catalog search (seebx -> Postgres via BRAINS proxy)
  const [exQ, setExQ] = React.useState<string>("");
  const [exResults, setExResults] = React.useState<ExerciseSearchHit[]>([]);
  const [exLoading, setExLoading] = React.useState<boolean>(false);
  const [exStatus, setExStatus] = React.useState<string>("");
  const [selectedCanonicalExercise, setSelectedCanonicalExercise] = React.useState<string>("");

  // “My Exercises” pool (local-only for now; mirrors My Foods direction)
  const [myExercises, setMyExercises] = React.useState<MyExercise[]>([]);

  async function runExerciseSearch(q: string) {
    const qq = String(q || "").trim();
    setExStatus("");
    if (!qq) {
      setExResults([]);
      return;
    }
    setExLoading(true);
    try {
      const u = new URL("/api/catalog/exercises/search", window.location.origin);
      u.searchParams.set("q", qq);
      u.searchParams.set("limit", "10");

      const r = await fetch(u.toString(), { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`exercise search failed: HTTP ${r.status} ${t}`);

      const j = JSON.parse(t);
      setExResults(Array.isArray(j) ? (j as ExerciseSearchHit[]) : []);
      setExStatus(Array.isArray(j) ? `hits=${j.length}` : "hits=?");
    } catch (e: any) {
      setExResults([]);
      setExStatus(`error: ${e?.message || String(e)}`);
    } finally {
      setExLoading(false);
    }
  }

  // debounce
  React.useEffect(() => {
    const qq = exQ.trim();
    const h = setTimeout(() => runExerciseSearch(qq), 250);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exQ]);

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

  React.useEffect(() => {
    // local-only persistence
    const saved = typeof window !== "undefined" ? lsGet<MyExercise[]>(LS_MY_EXERCISES_KEY, []) : [];
    setMyExercises(Array.isArray(saved) ? saved : []);
  }, []);

  function addMyExercise(hit: ExerciseSearchHit) {
    const ex: MyExercise = {
      exercise_id: hit.exercise_id,
      display_name: hit.display_name,
      kind: hit.kind,
      modality: hit.modality,
      brand_name: hit.brand_name ?? null,
      model_name: hit.model_name ?? null,
      matched_text: hit.matched_text ?? null,
      matched_source: hit.matched_source ?? null,
    };

    setMyExercises((prev) => {
      const exists = prev.some((p) => p.exercise_id === ex.exercise_id);
      const next = exists ? prev : [...prev, ex];
      lsSet(LS_MY_EXERCISES_KEY, next);
      return next;
    });

    setSelectedCanonicalExercise(ex.display_name);
    setExStatus(`saved: ${ex.display_name}`);
  }

  function removeMyExercise(exercise_id: string) {
    setMyExercises((prev) => {
      const next = prev.filter((p) => p.exercise_id !== exercise_id);
      lsSet(LS_MY_EXERCISES_KEY, next);
      return next;
    });
  }

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

      <div className="mt-4 rounded-xl border p-3">
        <div className="text-sm font-semibold">Exercise catalog (DB)</div>
        <div className="mt-1 text-xs opacity-70">
          Queries seebx catalog via <span className="font-mono">/api/catalog/exercises/search</span>. No writes.
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="opacity-70">Search</span>
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={exQ}
              onChange={(e) => setExQ(e.target.value)}
              placeholder='e.g., "hammer chest press", "cable pushdown"'
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="opacity-70">Selected canonical exercise</span>
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={
                selectedCanonicalExercise
                  ? (exResults.find((x) => x.exercise_id === selectedCanonicalExercise)?.display_name || selectedCanonicalExercise)
                  : ""
              }
              onChange={(e) => setSelectedCanonicalExercise(e.target.value)}
              placeholder="(click Use on a hit below)"
            />
          </label>

          <div className="mt-4 rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">My Exercises</div>
                <div className="mt-1 text-xs opacity-70">
                  Local-only pool (v0). Next step: persist to DB as lifeswitch_training.my_exercise.
                </div>
              </div>
              <div className="text-xs opacity-70">count={myExercises.length}</div>
            </div>

            {myExercises.length ? (
              <div className="mt-3 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left opacity-70">
                      <th className="py-1 pr-2">exercise</th>
                      <th className="py-1 pr-2">modality</th>
                      <th className="py-1 pr-2">brand</th>
                      <th className="py-1 pr-2">matched</th>
                      <th className="py-1 pr-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {myExercises.map((x) => (
                      <tr key={x.exercise_id} className="border-t">
                        <td className="py-1 pr-2">{x.display_name}</td>
                        <td className="py-1 pr-2">{x.modality}</td>
                        <td className="py-1 pr-2">{x.brand_name || ""}</td>
                        <td className="py-1 pr-2">
                          {x.matched_source ? `${x.matched_source}: ${x.matched_text || ""}` : ""}
                        </td>
                        <td className="py-1 pr-2">
                          <button
                            type="button"
                            className="rounded-lg bg-muted px-2 py-1 text-xs font-semibold hover:bg-muted/60"
                            onClick={() => removeMyExercise(x.exercise_id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-3 text-xs opacity-70">
                Empty. Use Exercise catalog search above and click <span className="font-mono">Save</span>.
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs opacity-70">
          <div>{exLoading ? "searching…" : exStatus}</div>
          <div className="ml-auto">{exResults.length ? `showing ${exResults.length}` : ""}</div>
        </div>

        {exResults.length ? (
          <div className="mt-3 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left opacity-70">
                  <th className="py-1 pr-2">exercise</th>
                  <th className="py-1 pr-2">kind</th>
                  <th className="py-1 pr-2">modality</th>
                  <th className="py-1 pr-2">matched</th>
                  <th className="py-1 pr-2">brand</th>
                  <th className="py-1 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {exResults.map((h) => (
                  <tr
                    key={h.exercise_id}
                    className={`border-t ${myExercises.some((x) => x.exercise_id === h.exercise_id) ? "bg-muted/30" : ""}`}
                  >
                    <td className="py-1 pr-2">{h.display_name}</td>
                    <td className="py-1 pr-2">{h.kind}</td>
                    <td className="py-1 pr-2">{h.modality}</td>
                    <td className="py-1 pr-2">
                      {h.matched_source ? `${h.matched_source}: ${h.matched_text || ""}` : ""}
                    </td>
                    <td className="py-1 pr-2">{h.brand_name || ""}</td>
                    <td className="py-1 pr-2">
                      <button
                        type="button"
                        className="rounded-lg bg-muted px-2 py-1 text-xs font-semibold hover:bg-muted/60"
                        onClick={() => addMyExercise(h)}
                      >
                        {selectedCanonicalExercise === h.exercise_id ? "Selected" : "Use"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
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
