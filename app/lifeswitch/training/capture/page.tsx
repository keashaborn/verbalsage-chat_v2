"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

type WorkoutTemplateRow = {
  workout_template_id: string;
  owner_user_id: string;
  name: string;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type WorkoutTemplateExerciseRow = {
  workout_template_exercise_id: string;
  workout_template_id: string;
  exercise_id: string;
  sort_order: number;
  planned_sets: number;
  default_weight: number;
  default_reps: number;
  flags?: string | null;
  created_at: string;
  updated_at: string;
};

type MyExerciseRow = {
  my_exercise_id: string;
  owner_user_id: string;
  exercise_id: string;
  display_name: string;
  kind: string;
  modality: string;
  brand_name?: string | null;
  model_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type DraftSetRow = {
  draft_id: string;
  exercise_id: string;
  exercise_name: string;
  exercise_sort_order: number;
  set_index: number;
  weight: string;
  reps: string;
  flags: string;
  include: boolean;
};

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function todayLocalYYYYMMDD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function makeDraftId(exerciseId: string, setIndex: number) {
  return `${exerciseId}::${setIndex}::${Math.random().toString(36).slice(2)}`;
}

export default function TrainingCapturePage() {
  const [owner, setOwner] = React.useState<string | null>(null);
  const [authErr, setAuthErr] = React.useState<string | null>(null);

  const [day, setDay] = React.useState(todayLocalYYYYMMDD());
  const [templates, setTemplates] = React.useState<WorkoutTemplateRow[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [templateExercises, setTemplateExercises] = React.useState<WorkoutTemplateExerciseRow[]>([]);
  const [myExercises, setMyExercises] = React.useState<MyExerciseRow[]>([]);

  const [loadingTemplates, setLoadingTemplates] = React.useState(false);
  const [loadingTemplateExercises, setLoadingTemplateExercises] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [flash, setFlash] = React.useState("");
  const [draftRows, setDraftRows] = React.useState<DraftSetRow[]>([]);
  const [finishLoading, setFinishLoading] = React.useState(false);

  const selected = React.useMemo(() => {
    return templates.find((t) => t.workout_template_id === selectedId) || null;
  }, [templates, selectedId]);

  const myExercisesById = React.useMemo(() => {
    const m = new Map<string, MyExerciseRow>();
    for (const row of myExercises) m.set(row.exercise_id, row);
    return m;
  }, [myExercises]);

  const includedRows = React.useMemo(() => draftRows.filter((r) => r.include), [draftRows]);

  const summary = React.useMemo(() => {
    let setCount = 0;
    let volume = 0;
    const exercises = new Set<string>();

    for (const r of includedRows) {
      const weight = safeNum(r.weight, 0);
      const reps = safeNum(r.reps, 0);
      if (reps <= 0) continue;

      setCount += 1;
      volume += weight * reps;
      exercises.add(r.exercise_id);
    }

    return {
      setCount,
      exerciseCount: exercises.size,
      volume,
    };
  }, [includedRows]);

  React.useEffect(() => {
    (async () => {
      try {
        const j = await fetchJson("/api/auth/whoami");
        if (!j?.ok) {
          setOwner(null);
          setAuthErr(j?.error || "not signed in");
          return;
        }

        const sub = String(j.sub || "").trim();
        if (!sub) {
          setOwner(null);
          setAuthErr("missing sub");
          return;
        }

        setOwner(sub);
        setAuthErr(null);
      } catch (e: any) {
        setOwner(null);
        setAuthErr(String(e?.message || e));
      }
    })();
  }, []);

  async function loadTemplates() {
    if (!owner) return;

    setLoadingTemplates(true);
    setStatus("");

    try {
      const qs = new URLSearchParams({ owner_user_id: owner });
      const list = (await fetchJson(`/api/lifeswitch/training/workout_templates?${qs.toString()}`)) as WorkoutTemplateRow[];
      const active = Array.isArray(list) ? list.filter((x) => x?.is_active) : [];

      setTemplates(active);
      if (!selectedId && active.length) setSelectedId(active[0].workout_template_id);
    } catch (e: any) {
      setTemplates([]);
      setStatus(String(e?.message || e));
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function loadMyExercises() {
    if (!owner) return;

    try {
      const qs = new URLSearchParams({ owner_user_id: owner });
      const list = (await fetchJson(`/api/lifeswitch/training/my_exercises?${qs.toString()}`)) as MyExerciseRow[];
      setMyExercises(Array.isArray(list) ? list.filter((x) => x?.is_active) : []);
    } catch {
      setMyExercises([]);
    }
  }

  async function loadTemplateExercises(workoutTemplateId: string) {
    if (!workoutTemplateId) {
      setTemplateExercises([]);
      setDraftRows([]);
      return;
    }

    setLoadingTemplateExercises(true);
    setStatus("");

    try {
      const list = (await fetchJson(
        `/api/lifeswitch/training/workout_templates/${encodeURIComponent(workoutTemplateId)}/exercises`
      )) as WorkoutTemplateExerciseRow[];

      const rows = Array.isArray(list)
        ? [...list].sort((a, b) => safeNum(a.sort_order, 0) - safeNum(b.sort_order, 0))
        : [];

      setTemplateExercises(rows);
      buildDraftRows(rows);
    } catch (e: any) {
      setTemplateExercises([]);
      setDraftRows([]);
      setStatus(String(e?.message || e));
    } finally {
      setLoadingTemplateExercises(false);
    }
  }

  function buildDraftRows(rows: WorkoutTemplateExerciseRow[]) {
    const out: DraftSetRow[] = [];

    for (const ex of rows) {
      const meta = myExercisesById.get(ex.exercise_id);
      const exerciseName = meta?.display_name || ex.exercise_id;
      const plannedSets = Math.max(0, Math.floor(safeNum(ex.planned_sets, 0)));

      for (let i = 1; i <= plannedSets; i++) {
        out.push({
          draft_id: makeDraftId(ex.exercise_id, i),
          exercise_id: ex.exercise_id,
          exercise_name: exerciseName,
          exercise_sort_order: safeNum(ex.sort_order, 0),
          set_index: i,
          weight: String(safeNum(ex.default_weight, 0)),
          reps: String(safeNum(ex.default_reps, 0)),
          flags: ex.flags || "",
          include: true,
        });
      }
    }

    setDraftRows(out);
  }

  React.useEffect(() => {
    if (!owner) return;
    void loadTemplates();
    void loadMyExercises();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);

  React.useEffect(() => {
    if (!selectedId) return;
    void loadTemplateExercises(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, myExercisesById]);

  function updateDraftRow(draftId: string, patch: Partial<DraftSetRow>) {
    setDraftRows((prev) => prev.map((r) => (r.draft_id === draftId ? { ...r, ...patch } : r)));
  }

  function addSetAfter(row: DraftSetRow) {
    const sameExercise = draftRows.filter((r) => r.exercise_id === row.exercise_id);
    const nextIndex = sameExercise.length ? Math.max(...sameExercise.map((r) => r.set_index)) + 1 : 1;

    const next: DraftSetRow = {
      ...row,
      draft_id: makeDraftId(row.exercise_id, nextIndex),
      set_index: nextIndex,
      include: true,
    };

    const idx = draftRows.findIndex((r) => r.draft_id === row.draft_id);
    if (idx < 0) {
      setDraftRows((prev) => [...prev, next]);
      return;
    }

    setDraftRows((prev) => {
      const copy = prev.slice();
      copy.splice(idx + 1, 0, next);
      return copy;
    });
  }

  function removeDraftRow(draftId: string) {
    setDraftRows((prev) => prev.filter((r) => r.draft_id !== draftId));
  }

  async function finishSession() {
    if (!owner || !selected) return;

    const validRows = includedRows.filter((r) => {
      const weight = safeNum(r.weight, 0);
      const reps = safeNum(r.reps, 0);
      return Number.isFinite(weight) && weight >= 0 && Number.isFinite(reps) && reps > 0;
    });

    if (!validRows.length) {
      setStatus("no valid included sets to finish");
      return;
    }

    setFinishLoading(true);
    setStatus(`finishing ${selected.name}...`);
    setFlash("");

    try {
      const session = await fetchJson("/api/lifeswitch/training/sessions/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          day,
          workout_template_id: selected.workout_template_id,
          name: selected.name,
          notes: selected.notes || "",
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
        }),
      });

      const sessionId = String(session?.training_session_id || "");
      if (!sessionId) throw new Error("missing training_session_id");

      for (const row of validRows) {
        await fetchJson(`/api/lifeswitch/training/sessions/${encodeURIComponent(sessionId)}/sets/add`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workout_template_id: selected.workout_template_id,
            exercise_id: row.exercise_id,
            exercise_name: row.exercise_name,
            exercise_sort_order: row.exercise_sort_order,
            set_index: row.set_index,
            weight: safeNum(row.weight, 0),
            reps: safeNum(row.reps, 0),
            flags: row.flags || "",
            notes: "",
          }),
        });
      }

      setFlash(`Finished ${selected.name}: ${validRows.length} sets logged`);
      setStatus("");
    } catch (e: any) {
      setStatus(String(e?.message || e));
    } finally {
      setFinishLoading(false);
    }
  }

  const byExercise = React.useMemo(() => {
    const map = new Map<string, DraftSetRow[]>();

    for (const row of draftRows) {
      const key = `${row.exercise_sort_order}::${row.exercise_id}`;
      const rows = map.get(key) || [];
      rows.push(row);
      map.set(key, rows);
    }

    return Array.from(map.entries())
      .sort((a, b) => safeNum(a[1]?.[0]?.exercise_sort_order, 0) - safeNum(b[1]?.[0]?.exercise_sort_order, 0))
      .map(([key, rows]) => ({ key, rows }));
  }, [draftRows]);

  if (authErr) {
    return (
      <div className="mx-auto max-w-5xl p-4">
        <div className="text-lg font-semibold">Training · Capture</div>
        <div className="mt-3 rounded-xl border p-3 text-sm">
          <div className="font-medium">Not signed in</div>
          <div className="mt-1 text-muted-foreground">/api/auth/whoami: {authErr}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Training · Capture</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Start from a workout template, edit today’s sets, then finish into the training log.
          </div>
        </div>

        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="rounded-xl border bg-background px-3 py-2 text-sm"
        />
      </div>

      {flash ? <div className="mt-3 text-sm text-green-600">{flash}</div> : null}
      {status ? <div className="mt-3 text-sm text-red-600">{status}</div> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[20rem_1fr]">
        <aside className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Workout template</div>
            <button
              type="button"
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted/30"
              onClick={() => void loadTemplates()}
              disabled={loadingTemplates}
            >
              {loadingTemplates ? "Loading..." : "Refresh"}
            </button>
          </div>

          <select
            className="mt-3 w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Select workout</option>
            {templates.map((t) => (
              <option key={t.workout_template_id} value={t.workout_template_id}>
                {t.name}
              </option>
            ))}
          </select>

          {selected ? (
            <div className="mt-4 rounded-xl border p-3 text-sm">
              <div className="font-medium">{selected.name}</div>
              {selected.notes ? <div className="mt-1 text-muted-foreground">{selected.notes}</div> : null}
              <div className="mt-3 text-xs text-muted-foreground">
                template exercises={templateExercises.length}
              </div>
              <button
                type="button"
                className="mt-3 rounded-xl border px-3 py-2 text-sm hover:bg-muted/30"
                onClick={() => buildDraftRows(templateExercises)}
                disabled={!templateExercises.length}
              >
                Reset draft from template
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border p-3 text-sm text-muted-foreground">
              Create workout templates in Workouts first.
            </div>
          )}

          <div className="mt-4 rounded-xl border p-3 text-xs text-muted-foreground">
            Capture changes are for this session only. Template updates will be added as an explicit option.
          </div>
        </aside>

        <main className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Active session draft</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {loadingTemplateExercises
                  ? "Loading template..."
                  : `${summary.exerciseCount} exercises · ${summary.setCount} included sets · volume ${Math.round(summary.volume)}`}
              </div>
            </div>

            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
              onClick={() => void finishSession()}
              disabled={!owner || !selected || finishLoading || summary.setCount === 0}
            >
              {finishLoading ? "Finishing..." : "Finish Session"}
            </button>
          </div>

          {draftRows.length ? (
            <div className="mt-4 space-y-5">
              {byExercise.map((block) => {
                const first = block.rows[0];

                return (
                  <section key={block.key} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{first.exercise_name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {block.rows.filter((r) => r.include).length} included sets
                        </div>
                      </div>

                      <button
                        type="button"
                        className="rounded-md border px-2 py-1 text-xs hover:bg-muted/30"
                        onClick={() => addSetAfter(block.rows[block.rows.length - 1])}
                      >
                        <Plus className="inline h-3 w-3" /> Set
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {block.rows.map((row) => (
                        <div
                          key={row.draft_id}
                          className={`grid gap-2 rounded-xl border p-2 sm:grid-cols-[2rem_3rem_1fr_1fr_1fr_2.5rem] sm:items-center ${
                            row.include ? "" : "opacity-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={row.include}
                            onChange={(e) => updateDraftRow(row.draft_id, { include: e.currentTarget.checked })}
                            title="Include this set"
                          />

                          <div className="text-xs text-muted-foreground">Set {row.set_index}</div>

                          <label className="text-xs">
                            <div className="text-muted-foreground">Weight</div>
                            <input
                              className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
                              inputMode="decimal"
                              value={row.weight}
                              onChange={(e) => {
                                const value = e.currentTarget.value;
                                updateDraftRow(row.draft_id, { weight: value });
                              }}
                            />
                          </label>

                          <label className="text-xs">
                            <div className="text-muted-foreground">Reps</div>
                            <input
                              className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
                              inputMode="numeric"
                              value={row.reps}
                              onChange={(e) => {
                                const value = e.currentTarget.value;
                                updateDraftRow(row.draft_id, { reps: value });
                              }}
                            />
                          </label>

                          <label className="text-xs">
                            <div className="text-muted-foreground">Flags</div>
                            <input
                              className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
                              value={row.flags}
                              onChange={(e) => {
                                const value = e.currentTarget.value;
                                updateDraftRow(row.draft_id, { flags: value });
                              }}
                              placeholder="optional"
                            />
                          </label>

                          <button
                            type="button"
                            className="rounded-md border p-2 hover:bg-muted/30"
                            onClick={() => removeDraftRow(row.draft_id)}
                            title="Remove set"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border p-4 text-sm text-muted-foreground">
              Select a workout template to generate today’s active session draft.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
