"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

type MyExercise = {
  exercise_id: string;
  display_name: string;
  kind: string;
  modality: string;
  brand_name?: string | null;
  model_name?: string | null;
  matched_text?: string | null;
  matched_source?: string | null;
};

type WorkoutTemplateExercise = {
  exercise_id: string;
  planned_sets: number;      // default 3
  default_weight: number;    // lbs, default 0
  default_reps: number;      // default 10
  flags?: string;            // e.g. "dropset", "superset:A", "warmup"
};

type WorkoutTemplate = {
  workout_id: string;
  name: string;
  notes?: string;
  exercises: WorkoutTemplateExercise[];
  created_at: string;
  updated_at: string;
};

const LS_WORKOUT_TEMPLATES_KEY = "lifeswitch_workout_templates_v0";

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

function uuidLike() {
  // good enough for local IDs
  return crypto?.randomUUID ? crypto.randomUUID() : `wkt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function norm(s: string) {
  return String(s || "").trim().toLowerCase();
}

export default function TrainingWorkoutsPage() {
  const [myExercises, setMyExercises] = React.useState<MyExercise[]>([]);
  const [templates, setTemplates] = React.useState<WorkoutTemplate[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");

  // create form
  const [newName, setNewName] = React.useState<string>("");

  // add-exercise search
  const [q, setQ] = React.useState<string>("");

  const [owner, setOwner] = React.useState<string | null>(null);
  const [authErr, setAuthErr] = React.useState<string | null>(null);

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

  const [myLoading, setMyLoading] = React.useState(false);

  const loadMyExercises = React.useCallback(async () => {
    if (!owner) return;
    setMyLoading(true);
    try {
      const qs = new URLSearchParams({ owner_user_id: owner });
      const j = (await fetchJson(`/api/lifeswitch/training/my_exercises?${qs.toString()}`)) as any;
      setMyExercises(Array.isArray(j) ? (j as MyExercise[]) : []);
    } catch {
      setMyExercises([]);
    } finally {
      setMyLoading(false);
    }
  }, [owner]);

  React.useEffect(() => {
    if (owner) void loadMyExercises();
  }, [owner, loadMyExercises]);

  React.useEffect(() => {
    // TEMP: templates still local until step 2
    const ts = lsGet<WorkoutTemplate[]>(LS_WORKOUT_TEMPLATES_KEY, []);
    const arr = Array.isArray(ts) ? ts : [];
    arr.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
    setTemplates(arr);
    if (!selectedId && arr.length) setSelectedId(arr[0].workout_id);
  }, []);

  const selected = React.useMemo(() => {
    return templates.find((t) => t.workout_id === selectedId) || null;
  }, [templates, selectedId]);

  const myExercisesById = React.useMemo(() => {
    const m = new Map<string, MyExercise>();
    for (const x of myExercises) m.set(x.exercise_id, x);
    return m;
  }, [myExercises]);

  const hits = React.useMemo(() => {
    const qq = norm(q);
    if (!qq) return [];
    // search within My Exercises only (curated set)
    const out = myExercises
      .filter((x) => norm(x.display_name).includes(qq))
      .slice(0, 20);
    return out;
  }, [q, myExercises]);

  function persist(next: WorkoutTemplate[]) {
    setTemplates(next);
    lsSet(LS_WORKOUT_TEMPLATES_KEY, next);
  }

  function createTemplate() {
    const name = newName.trim();
    if (!name) return;

    const now = new Date().toISOString();
    const t: WorkoutTemplate = {
      workout_id: uuidLike(),
      name,
      notes: "",
      exercises: [],
      created_at: now,
      updated_at: now,
    };

    const next = [t, ...templates];
    persist(next);
    setSelectedId(t.workout_id);
    setNewName("");
  }

  async function fetchJson(url: string, init?: RequestInit) {
    const r = await fetch(url, { cache: "no-store", ...(init || {}) });
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

  function updateSelected(patch: Partial<WorkoutTemplate>) {
    if (!selected) return;
    const now = new Date().toISOString();
    const next = templates.map((t) =>
      t.workout_id === selected.workout_id ? { ...t, ...patch, updated_at: now } : t
    );
    persist(next);
  }

  function deleteTemplate(workout_id: string) {
    const next = templates.filter((t) => t.workout_id !== workout_id);
    persist(next);
    if (selectedId === workout_id) setSelectedId(next[0]?.workout_id || "");
  }

  function addExerciseToSelected(exercise_id: string) {
    if (!selected) return;
    const exists = selected.exercises.some((e) => e.exercise_id === exercise_id);
    if (exists) return;

    const nextExercises = [
      ...selected.exercises,
      { exercise_id, planned_sets: 3, default_weight: 0, default_reps: 10, flags: "" },
    ];
    updateSelected({ exercises: nextExercises });
    setQ("");
  }

  function removeExerciseFromSelected(exercise_id: string) {
    if (!selected) return;
    const nextExercises = selected.exercises.filter((e) => e.exercise_id !== exercise_id);
    updateSelected({ exercises: nextExercises });
  }

  function moveExercise(exercise_id: string, dir: -1 | 1) {
    if (!selected) return;
    const idx = selected.exercises.findIndex((e) => e.exercise_id === exercise_id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= selected.exercises.length) return;
    const copy = selected.exercises.slice();
    const tmp = copy[idx];
    copy[idx] = copy[j];
    copy[j] = tmp;
    updateSelected({ exercises: copy });
  }

  function updateExercise(exercise_id: string, patch: Partial<WorkoutTemplateExercise>) {
    if (!selected) return;
    const copy = selected.exercises.map((e) => (e.exercise_id === exercise_id ? { ...e, ...patch } : e));
    updateSelected({ exercises: copy });
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

      {/* Create */}
      <div className="mt-6 flex items-center gap-2">
        <input
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder='New workout name (e.g. "Pull A", "Leg Day 1")'
          onKeyDown={(e) => {
            if (e.key === "Enter") createTemplate();
          }}
        />
        <button
          type="button"
          className="shrink-0 rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
          onClick={createTemplate}
          disabled={!newName.trim()}
          title="Create workout"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* List */}
      <div className="mt-6">
        <div className="text-sm font-semibold">Your workouts</div>

        {templates.length ? (
          <div className="mt-2 divide-y divide-muted/20">
            {templates.map((t) => {
              const active = t.workout_id === selectedId;
              const cls = [
                "py-3 flex items-start justify-between gap-3",
                "cursor-pointer",
                active ? "bg-muted/20" : "hover:bg-muted/10",
                "rounded-xl px-2 -mx-2",
              ].join(" ");

              return (
                <div
                  key={t.workout_id}
                  className={cls}
                  onClick={() => setSelectedId(t.workout_id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedId(t.workout_id);
                  }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      exercises={t.exercises.length}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="shrink-0 rounded-xl border px-3 py-2 text-sm hover:bg-muted/30"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTemplate(t.workout_id);
                    }}
                    title="Delete workout"
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

      {/* Editor */}
      {selected ? (
        <div className="mt-8">
          <div className="text-sm font-semibold">Edit</div>

          <div className="mt-2">
            <div className="text-xs text-muted-foreground">Name</div>
            <input
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={selected.name}
              onChange={(e) => updateSelected({ name: e.target.value })}
              placeholder="Workout name"
            />
          </div>

          <div className="mt-3">
            <div className="text-xs text-muted-foreground">Notes</div>
            <input
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={selected.notes || ""}
              onChange={(e) => updateSelected({ notes: e.target.value })}
              placeholder="(optional)"
            />
          </div>

          {/* Add exercises */}
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
                      <button
                        key={h.exercise_id}
                        type="button"
                        className="w-full py-3 text-left hover:bg-muted/20"
                        onClick={() => addExerciseToSelected(h.exercise_id)}
                      >
                        <div className="text-sm font-medium">{h.display_name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {h.modality}{h.kind ? ` · ${h.kind}` : ""}{h.brand_name ? ` · ${h.brand_name}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-muted-foreground">No matches in My Exercises.</div>
                )
              ) : null}
            </div>
          </div>

          {/* Template exercises */}
          <div className="mt-8">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Exercises in this workout</div>
              <div className="text-xs text-muted-foreground">count={selected.exercises.length}</div>
            </div>

            {selected.exercises.length ? (
              <div className="mt-2 divide-y divide-muted/20">
                {selected.exercises.map((e) => {
                  const meta = myExercisesById.get(e.exercise_id);
                  const title = meta?.display_name || e.exercise_id;

                  return (
                    <div key={e.exercise_id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {meta?.modality || ""}{meta?.kind ? ` · ${meta.kind}` : ""}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            className="rounded-md p-2 hover:bg-muted/20 active:bg-muted/30"
                            onClick={() => moveExercise(e.exercise_id, -1)}
                            title="Move up"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-2 hover:bg-muted/20 active:bg-muted/30"
                            onClick={() => moveExercise(e.exercise_id, 1)}
                            title="Move down"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-2 hover:bg-muted/20 active:bg-muted/30"
                            onClick={() => removeExerciseFromSelected(e.exercise_id)}
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
                            onChange={(ev) => updateExercise(e.exercise_id, { planned_sets: Number(ev.target.value || 0) })}
                          />
                        </label>

                        <label className="flex items-baseline gap-2">
                          <span className="text-[11px] text-muted-foreground">wt</span>
                          <input
                            className="w-16 bg-transparent border-b border-muted/30 px-1 py-1 text-sm focus:outline-none focus:border-ring"
                            inputMode="decimal"
                            value={String(e.default_weight)}
                            onChange={(ev) => updateExercise(e.exercise_id, { default_weight: Number(ev.target.value || 0) })}
                          />
                        </label>

                        <label className="flex items-baseline gap-2">
                          <span className="text-[11px] text-muted-foreground">reps</span>
                          <input
                            className="w-12 bg-transparent border-b border-muted/30 px-1 py-1 text-sm focus:outline-none focus:border-ring"
                            inputMode="numeric"
                            value={String(e.default_reps)}
                            onChange={(ev) => updateExercise(e.exercise_id, { default_reps: Number(ev.target.value || 0) })}
                          />
                        </label>
                      </div>

                      <div className="mt-2">
                        <input
                          className="w-full bg-transparent border-b border-muted/30 px-1 py-2 text-sm focus:outline-none focus:border-ring"
                          value={e.flags || ""}
                          onChange={(ev) => updateExercise(e.exercise_id, { flags: ev.target.value })}
                          placeholder='flags (optional): "dropset", "superset:A", "warmup"'
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">
                Empty. Search My Exercises above and add a few.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
