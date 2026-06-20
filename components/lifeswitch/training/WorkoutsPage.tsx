"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";
import { ChevronUp, ChevronDown, Plus, Trash2 } from "lucide-react";

type MyExerciseRow = {
  my_exercise_id: string;
  owner_user_id: string;
  exercise_id: string;
  display_name: string;
  kind: string;
  modality: string;
  brand_name?: string | null;
  model_name?: string | null;
  matched_text?: string | null;
  matched_source?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

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
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

async function fetchJson(url: string, init?: RequestInit) {
  const r = await authFetch(url, { cache: "no-store", ...(init || {}) });
  const t = await r.text();
  let j: any = null;
  try {
    j = t ? JSON.parse(t) : null;
  } catch {
    // ignore
  }
  if (!r.ok) {
    const detail = j?.detail || j?.error || t?.slice(0, 300) || `HTTP ${r.status}`;
    throw new Error(String(detail));
  }
  return j;
}

function norm(s: string) {
  return String(s || "").trim().toLowerCase();
}

export default function TrainingWorkoutsPage() {
  const [owner, setOwner] = React.useState<string | null>(null);
  const [authErr, setAuthErr] = React.useState<string | null>(null);

  const [myExercises, setMyExercises] = React.useState<MyExerciseRow[]>([]);
  const [templates, setTemplates] = React.useState<WorkoutTemplateRow[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");

  const [templateExercises, setTemplateExercises] = React.useState<WorkoutTemplateExerciseRow[]>([]);
  const [myLoading, setMyLoading] = React.useState(false);
  const [tplLoading, setTplLoading] = React.useState(false);
  const [exLoading, setExLoading] = React.useState(false);

  const [newName, setNewName] = React.useState<string>("");
  const [q, setQ] = React.useState<string>("");

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

  const loadMyExercises = React.useCallback(async () => {
    if (!owner) return;
    setMyLoading(true);
    try {
      const qs = new URLSearchParams({ owner_user_id: owner });
      const j = (await fetchJson(`/api/lifeswitch/training/my_exercises?${qs.toString()}`)) as any;
      const arr = Array.isArray(j) ? (j as MyExerciseRow[]) : [];
      setMyExercises(arr.filter((x) => x.is_active));
    } catch {
      setMyExercises([]);
    } finally {
      setMyLoading(false);
    }
  }, [owner]);

  const loadTemplates = React.useCallback(async () => {
    if (!owner) return;
    setTplLoading(true);
    try {
      const qs = new URLSearchParams({ owner_user_id: owner });
      const j = (await fetchJson(`/api/lifeswitch/training/workout_templates?${qs.toString()}`)) as any;
      const arr = Array.isArray(j) ? (j as WorkoutTemplateRow[]) : [];
      const active = arr.filter((x) => x.is_active);
      active.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      setTemplates(active);
      if (!selectedId && active.length) setSelectedId(active[0].workout_template_id);
    } catch {
      setTemplates([]);
    } finally {
      setTplLoading(false);
    }
  }, [owner, selectedId]);

  const loadTemplateExercises = React.useCallback(
    async (workout_template_id: string) => {
      if (!owner) return;
      if (!workout_template_id) {
        setTemplateExercises([]);
        return;
      }
      setExLoading(true);
      try {
        const qs = new URLSearchParams({ owner_user_id: owner });
        const j = (await fetchJson(
          `/api/lifeswitch/training/workout_templates/${encodeURIComponent(workout_template_id)}/exercises?${qs.toString()}`
        )) as any;
        const arr = Array.isArray(j) ? (j as WorkoutTemplateExerciseRow[]) : [];
        arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        setTemplateExercises(arr);
      } catch {
        setTemplateExercises([]);
      } finally {
        setExLoading(false);
      }
    },
    [owner]
  );

  React.useEffect(() => {
    if (!owner) return;
    void loadMyExercises();
    void loadTemplates();
  }, [owner, loadMyExercises, loadTemplates]);

  React.useEffect(() => {
    if (!owner) return;
    if (!selectedId) {
      setTemplateExercises([]);
      return;
    }
    void loadTemplateExercises(selectedId);
  }, [owner, selectedId, loadTemplateExercises]);

  const selected = React.useMemo(() => {
    return templates.find((t) => t.workout_template_id === selectedId) || null;
  }, [templates, selectedId]);

  const myExercisesById = React.useMemo(() => {
    const m = new Map<string, MyExerciseRow>();
    for (const x of myExercises) m.set(x.exercise_id, x);
    return m;
  }, [myExercises]);

  const hits = React.useMemo(() => {
    const qq = norm(q);
    if (!qq) return [];
    return myExercises.filter((x) => norm(x.display_name).includes(qq)).slice(0, 20);
  }, [q, myExercises]);

  async function createTemplate() {
    if (!owner) return;
    const name = newName.trim();
    if (!name) return;

    const qs = new URLSearchParams({ owner_user_id: owner });
    await fetchJson(`/api/lifeswitch/training/workout_templates/upsert?${qs.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, notes: "" }),
    });

    setNewName("");
    await loadTemplates();
  }

  async function updateSelected(patch: { name?: string; notes?: string | null }) {
    if (!owner || !selected) return;
    const qs = new URLSearchParams({ owner_user_id: owner });
    await fetchJson(`/api/lifeswitch/training/workout_templates/upsert?${qs.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workout_template_id: selected.workout_template_id,
        name: patch.name ?? selected.name,
        notes: patch.notes ?? selected.notes ?? "",
      }),
    });
    await loadTemplates();
  }

  async function deactivateTemplate(workout_template_id: string) {
    if (!owner) return;
    const qs = new URLSearchParams({ owner_user_id: owner });
    await fetchJson(
      `/api/lifeswitch/training/workout_templates/${encodeURIComponent(workout_template_id)}/deactivate?${qs.toString()}`,
      { method: "POST" }
    );
    if (selectedId === workout_template_id) setSelectedId("");
    await loadTemplates();
  }

  async function addExerciseToSelected(exercise_id: string) {
    if (!owner || !selected) return;
    if (templateExercises.some((e) => e.exercise_id === exercise_id)) return;

    const qs = new URLSearchParams({ owner_user_id: owner });
    const maxSort = templateExercises.length ? Math.max(...templateExercises.map((x) => x.sort_order || 0)) : 0;

    await fetchJson(
      `/api/lifeswitch/training/workout_templates/${encodeURIComponent(selected.workout_template_id)}/exercises/upsert?${qs.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_id,
          planned_sets: 3,
          default_weight: 0,
          default_reps: 10,
          flags: "",
          sort_order: maxSort + 10,
        }),
      }
    );

    setQ("");
    await loadTemplateExercises(selected.workout_template_id);
  }

  async function removeExerciseFromSelected(workout_template_exercise_id: string) {
    if (!owner || !selected) return;
    const qs = new URLSearchParams({ owner_user_id: owner });

    await fetchJson(
      `/api/lifeswitch/training/workout_templates/${encodeURIComponent(
        selected.workout_template_id
      )}/exercises/${encodeURIComponent(workout_template_exercise_id)}/delete?${qs.toString()}`,
      { method: "POST" }
    );

    await loadTemplateExercises(selected.workout_template_id);
  }

  async function reorderExercises(next: WorkoutTemplateExerciseRow[]) {
    if (!owner || !selected) return;
    const qs = new URLSearchParams({ owner_user_id: owner });

    for (let i = 0; i < next.length; i++) {
      const row = next[i];
      await fetchJson(
        `/api/lifeswitch/training/workout_templates/${encodeURIComponent(selected.workout_template_id)}/exercises/upsert?${qs.toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workout_template_exercise_id: row.workout_template_exercise_id,
            exercise_id: row.exercise_id,
            planned_sets: row.planned_sets,
            default_weight: row.default_weight,
            default_reps: row.default_reps,
            flags: row.flags ?? "",
            sort_order: (i + 1) * 10,
          }),
        }
      );
    }

    await loadTemplateExercises(selected.workout_template_id);
  }

  async function moveExercise(workout_template_exercise_id: string, dir: -1 | 1) {
    if (!selected) return;
    const idx = templateExercises.findIndex((e) => e.workout_template_exercise_id === workout_template_exercise_id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= templateExercises.length) return;
    const copy = templateExercises.slice();
    const tmp = copy[idx];
    copy[idx] = copy[j];
    copy[j] = tmp;
    await reorderExercises(copy);
  }

  async function updateExercise(workout_template_exercise_id: string, patch: Partial<WorkoutTemplateExerciseRow>) {
    if (!owner || !selected) return;
    const row = templateExercises.find((x) => x.workout_template_exercise_id === workout_template_exercise_id);
    if (!row) return;
    const qs = new URLSearchParams({ owner_user_id: owner });

    await fetchJson(
      `/api/lifeswitch/training/workout_templates/${encodeURIComponent(selected.workout_template_id)}/exercises/upsert?${qs.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workout_template_exercise_id,
          exercise_id: row.exercise_id,
          planned_sets: patch.planned_sets ?? row.planned_sets,
          default_weight: patch.default_weight ?? row.default_weight,
          default_reps: patch.default_reps ?? row.default_reps,
          flags: (patch.flags ?? row.flags ?? "") as any,
          sort_order: patch.sort_order ?? row.sort_order,
        }),
      }
    );

    await loadTemplateExercises(selected.workout_template_id);
  }

  if (authErr) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="text-xl font-semibold">Training · Workouts</div>
        <div className="mt-2 rounded-md border p-3 text-sm">
          <div className="font-medium">Not signed in</div>
          <div className="mt-1 text-muted-foreground">/api/auth/whoami: {authErr}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="text-xl font-semibold">Training · Workouts</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Build workout templates from <span className="font-medium">My Exercises</span>.
      </div>

      <div className="mt-6 flex items-center gap-2">
        <input
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder='New workout name (e.g. "Pull A", "Leg Day 1")'
          onKeyDown={(e) => {
            if (e.key === "Enter") void createTemplate();
          }}
        />
        <button
          type="button"
          className="shrink-0 rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
          onClick={() => void createTemplate()}
          disabled={!newName.trim() || !owner}
          title="Create workout"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Your workouts</div>
          <div className="text-xs text-muted-foreground">{tplLoading ? "…" : `count=${templates.length}`}</div>
        </div>

        {templates.length ? (
          <div className="mt-2 divide-y divide-muted/20">
            {templates.map((t) => {
              const active = t.workout_template_id === selectedId;
              const cls = [
                "py-3 flex items-start justify-between gap-3",
                "cursor-pointer",
                active ? "bg-muted/20" : "hover:bg-muted/10",
                "rounded-xl px-2 -mx-2",
              ].join(" ");

              return (
                <div
                  key={t.workout_template_id}
                  className={cls}
                  onClick={() => setSelectedId(t.workout_template_id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedId(t.workout_template_id);
                  }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      updated={String(t.updated_at || "").slice(0, 10)}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="shrink-0 rounded-xl border px-3 py-2 text-sm hover:bg-muted/30"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deactivateTemplate(t.workout_template_id);
                    }}
                    title="Deactivate workout"
                    disabled={!owner}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">No workouts yet. Create one above.</div>
        )}
      </div>

      {selected ? (
        <div className="mt-8">
          <div className="text-sm font-semibold">Edit</div>

          <div className="mt-2">
            <div className="text-xs text-muted-foreground">Name</div>
            <input
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={selected.name}
              onChange={(e) => void updateSelected({ name: e.target.value })}
              placeholder="Workout name"
            />
          </div>

          <div className="mt-3">
            <div className="text-xs text-muted-foreground">Notes</div>
            <input
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={selected.notes || ""}
              onChange={(e) => void updateSelected({ notes: e.target.value })}
              placeholder="(optional)"
            />
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold">Add exercises</div>
            <div className="mt-2">
              <input
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder='Search My Exercises (e.g. "lat pulldown", "leg extension")'
              />
              {q.trim() ? (
                hits.length ? (
                  <div className="mt-2 divide-y divide-muted/20">
                    {hits.map((h) => (
                      <div
                        key={h.exercise_id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{h.display_name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {h.modality}
                            {h.kind ? ` · ${h.kind}` : ""}
                            {h.brand_name ? ` · ${h.brand_name}` : ""}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="shrink-0 rounded-xl border px-3 py-1.5 text-xs hover:bg-muted/30"
                          onClick={() => void addExerciseToSelected(h.exercise_id)}
                          disabled={!owner || !selected}
                          title="Add exercise to workout"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-muted-foreground">No matches in My Exercises.</div>
                )
              ) : null}
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Exercises in this workout</div>
              <div className="text-xs text-muted-foreground">{exLoading ? "…" : `count=${templateExercises.length}`}</div>
            </div>

            {templateExercises.length ? (
              <div className="mt-2 divide-y divide-muted/20">
                {templateExercises.map((e) => {
                  const meta = myExercisesById.get(e.exercise_id);
                  const title = meta?.display_name || e.exercise_id;

                  return (
                    <div key={e.workout_template_exercise_id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {meta?.modality || ""}
                            {meta?.kind ? ` · ${meta.kind}` : ""}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            className="rounded-md p-2 hover:bg-muted/20 active:bg-muted/30"
                            onClick={() => void moveExercise(e.workout_template_exercise_id, -1)}
                            title="Move up"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-2 hover:bg-muted/20 active:bg-muted/30"
                            onClick={() => void moveExercise(e.workout_template_exercise_id, 1)}
                            title="Move down"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-2 hover:bg-muted/20 active:bg-muted/30"
                            onClick={() => void removeExerciseFromSelected(e.workout_template_exercise_id)}
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex items-end gap-4 text-sm">
                        <label className="flex items-baseline gap-2">
                          <span className="text-[11px] text-muted-foreground">sets</span>
                          <input
                            className="w-12 bg-transparent border-b border-muted/30 px-1 py-1 text-sm focus:outline-none focus:border-ring"
                            inputMode="numeric"
                            value={String(e.planned_sets)}
                            onChange={(ev) =>
                              void updateExercise(e.workout_template_exercise_id, { planned_sets: Number(ev.target.value || 0) })
                            }
                          />
                        </label>

                        <label className="flex items-baseline gap-2">
                          <span className="text-[11px] text-muted-foreground">wt</span>
                          <input
                            className="w-16 bg-transparent border-b border-muted/30 px-1 py-1 text-sm focus:outline-none focus:border-ring"
                            inputMode="decimal"
                            value={String(e.default_weight)}
                            onChange={(ev) =>
                              void updateExercise(e.workout_template_exercise_id, { default_weight: Number(ev.target.value || 0) })
                            }
                          />
                        </label>

                        <label className="flex items-baseline gap-2">
                          <span className="text-[11px] text-muted-foreground">reps</span>
                          <input
                            className="w-12 bg-transparent border-b border-muted/30 px-1 py-1 text-sm focus:outline-none focus:border-ring"
                            inputMode="numeric"
                            value={String(e.default_reps)}
                            onChange={(ev) =>
                              void updateExercise(e.workout_template_exercise_id, { default_reps: Number(ev.target.value || 0) })
                            }
                          />
                        </label>
                      </div>

                      <div className="mt-2">
                        <input
                          className="w-full bg-transparent border-b border-muted/30 px-1 py-2 text-sm focus:outline-none focus:border-ring"
                          value={e.flags || ""}
                          onChange={(ev) => void updateExercise(e.workout_template_exercise_id, { flags: ev.target.value })}
                          placeholder='flags (optional): "dropset", "superset:A", "warmup"'
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">Empty. Search My Exercises above and add a few.</div>
            )}
          </div>

          <div className="mt-3 text-xs text-muted-foreground">{myLoading ? "Loading My Exercises…" : ""}</div>
        </div>
      ) : null}
    </div>
  );
}
