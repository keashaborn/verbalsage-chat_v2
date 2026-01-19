"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";


type TemplateListItem = {
  template_id: string;
  name: string;
  status: string;
  created_at: string;
  latest_version_id?: string | null;
  latest_version?: number | null;
  latest_version_created_at?: string | null;
};

type FormVersion = {
  version_id: string;
  template_id: string;
  version: number;
  json_schema: any;
  ui_schema: any;
  metadata: any;
  created_at: string;
};

function coerceNumber(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function extractUuid(s: string): string | null {
  const m = String(s || "")
    .trim()
    .match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0] : null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CollectPage() {

  function goBack() {
    try {
      if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
      else window.location.assign("/lifeswitch");
    } catch {
      window.location.assign("/lifeswitch");
    }
  }
  const [status, setStatus] = React.useState<string>("");

  const [ownerUserId, setOwnerUserId] = React.useState<string>("");

  const [templates, setTemplates] = React.useState<TemplateListItem[]>([]);
  const [loadingPrograms, setLoadingPrograms] = React.useState(false);

  const subjectId = "self";
  const [programVid, setProgramVid] = React.useState<string>("");

  const [programVersion, setProgramVersion] = React.useState<FormVersion | null>(null);

  // Program-specific UI state
  const [date, setDate] = React.useState<string>(todayISO());
  const [context, setContext] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");

  // Recent entries for selected program (for prefill / next set index)
  const [programRows, setProgramRows] = React.useState<any[]>([]);
  const [loadingProgramRows, setLoadingProgramRows] = React.useState(false);

  // Workout Set capture state (schemas with exercise/weight/reps/set_index)
  const [wsWorkout, setWsWorkout] = React.useState<string>("");
  const [wsShowDetails, setWsShowDetails] = React.useState<boolean>(false);
  const [wsExercise, setWsExercise] = React.useState<string>("");
  const [wsSetIndex, setWsSetIndex] = React.useState<string>("1");
  const [wsWeight, setWsWeight] = React.useState<string>("");
  const [wsReps, setWsReps] = React.useState<string>("");
  const [wsRpe, setWsRpe] = React.useState<string>("");
  const [isReordering, setIsReordering] = React.useState(false);


  // Count
  const [countStep, setCountStep] = React.useState<number>(1);

  // Duration
  const [durationRunning, setDurationRunning] = React.useState(false);
  const durationStartPerf = React.useRef<number | null>(null);
  const durationInterval = React.useRef<any>(null);
  const [durationSec, setDurationSec] = React.useState<number>(0);

  // These are global overlay template versions; exclude from program dropdown.
  const PHASE_TEMPLATE_VERSION_ID = "17211955-c47a-4c2a-b55f-55cc06065bc3";
  const CORRECTION_TEMPLATE_VERSION_ID = "82210580-9e1b-4b60-8bf6-39032b0b4915";

  // Derive owner from session (do not show in UI)
  React.useEffect(() => {
    if (ownerUserId) return;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user?.id) throw new Error("not signed in");
        setOwnerUserId(data.user.id);
      } catch (e: any) {
        setStatus(`error: ${e?.message || String(e)}`);
      }
    })();
  }, [ownerUserId]);

  async function refreshCapture() {
    try {
      setStatus("");
      setDate(todayISO());
      setContext("");
      setNotes("");
      setIsReordering(false);

      await loadPrograms();

      const tv = extractUuid(programVid);
      if (tv) {
        await loadProgramRows(tv);
      }
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

  async function loadPrograms() {
    setLoadingPrograms(true);
    setStatus("");
    try {
      if (!ownerUserId.trim()) throw new Error("owner not ready");
      const r = await fetch(`/api/forms/templates/${encodeURIComponent(ownerUserId.trim())}`, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`programs failed: HTTP ${r.status} ${t}`);
      const j = JSON.parse(t);
      const list: TemplateListItem[] = Array.isArray(j) ? j : [];
      setTemplates(list);
      setStatus(list.length ? `loaded ${list.length} programs` : "no programs");
    } catch (e: any) {
      setTemplates([]);
      setStatus(`error: ${e?.message || String(e)}`);
    } finally {
      setLoadingPrograms(false);
    }
  }

  async function loadProgramVersion(versionId: string) {
    setProgramVersion(null);
    setStatus("");
    const tv = extractUuid(versionId);
    if (!tv) return;

    try {
      const r = await fetch(`/api/forms/versions/${encodeURIComponent(tv)}`, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`program version failed: HTTP ${r.status} ${t}`);
      const v = JSON.parse(t) as FormVersion;
      setProgramVersion(v);

      // Reset per-program UI defaults
      setDate(todayISO());
      setContext("");
      setNotes("");
      setCountStep(1);
      resetDuration();

      setStatus(`loaded program v${v.version}`);
    } catch (e: any) {
      setProgramVersion(null);
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

  React.useEffect(() => {
    if (!ownerUserId.trim()) return;
    // Auto-load once on first ready owner
    loadPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId]);

  React.useEffect(() => {
    if (!programVid.trim()) return;
    loadProgramVersion(programVid.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programVid]);

  async function loadProgramRows(tv: string) {
    setLoadingProgramRows(true);
    try {
      if (!ownerUserId.trim() || !subjectId.trim() || !tv) {
        setProgramRows([]);
        return;
      }

      const qs = new URLSearchParams();
      qs.set("owner_user_id", ownerUserId.trim());
      qs.set("subject_id", subjectId.trim());
      qs.set("template_version_id", tv);
      qs.set("limit", "200");

      const r = await fetch(`/api/forms/entries/list?${qs.toString()}`, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`entries failed: HTTP ${r.status} ${t}`);

      const rows = JSON.parse(t);
      setProgramRows(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
      setProgramRows([]);
    } finally {
      setLoadingProgramRows(false);
    }
  }

  React.useEffect(() => {
    const tv = extractUuid(programVid);
    if (!ownerUserId.trim() || !subjectId.trim() || !tv) {
      setProgramRows([]);
      return;
    }
    loadProgramRows(tv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId, subjectId, programVid]);


  function measurementType(): string {
    const md = (programVersion?.metadata || {}) as any;
    return String(md?.measurement?.type || md?.program_spec_v0?.measurement?.type || "");
  }

  function schemaProps(): Record<string, any> {
    return (programVersion?.json_schema?.properties || {}) as Record<string, any>;
  }

  function durationKey(props: Record<string, any>): string | null {
    if (props.duration_seconds) return "duration_seconds";
    if (props.durationSeconds) return "durationSeconds";
    if (props.duration) return "duration";
    return null;
  }

  function startDuration() {
    if (durationRunning) return;
    setDurationSec(0);
    durationStartPerf.current = performance.now();
    setDurationRunning(true);

    try {
      if (durationInterval.current) clearInterval(durationInterval.current);
    } catch { }

    durationInterval.current = setInterval(() => {
      if (durationStartPerf.current === null) return;
      const sec = Math.max(0, Math.round((performance.now() - durationStartPerf.current) / 1000));
      setDurationSec(sec);
    }, 250);
  }

  function stopDuration(): number {
    const start = durationStartPerf.current;
    let sec = durationSec;
    if (start !== null) {
      sec = Math.max(0, Math.round((performance.now() - start) / 1000));
      setDurationSec(sec);
    }
    setDurationRunning(false);
    durationStartPerf.current = null;
    try {
      if (durationInterval.current) clearInterval(durationInterval.current);
    } catch { }
    durationInterval.current = null;
    return sec;
  }

  function resetDuration() {
    stopDuration();
    setDurationSec(0);
  }

  React.useEffect(() => {
    return () => {
      try {
        if (durationInterval.current) clearInterval(durationInterval.current);
      } catch { }
    };
  }, []);

  async function submitEntryToVid(templateVid: string, data: Record<string, any>) {
    if (!ownerUserId.trim()) throw new Error("owner not ready");
    if (!subjectId.trim()) throw new Error("client required");

    const tv = extractUuid(templateVid);
    if (!tv) throw new Error("program required");

    const payload = {
      owner_user_id: ownerUserId.trim(),
      subject_id: subjectId.trim(),
      template_version_id: tv,
      data,
    };

    const r = await fetch("/api/forms/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const t = await r.text().catch(() => "");
    if (!r.ok) throw new Error(`submit failed: HTTP ${r.status} ${t}`);

    return JSON.parse(t);
  }

  async function submitEntry(data: Record<string, any>) {
    return submitEntryToVid(programVid, data);
  }




  async function recordWorkoutSet() {
    setStatus("");
    try {
      if (!programVersion) throw new Error("program not loaded");
      const tv = extractUuid(programVid);
      if (!tv) throw new Error("program required");
      if (!date.trim()) throw new Error("date required");

      const ex = wsExercise.trim();
      if (!ex) throw new Error("exercise required");

      const siRaw = Number(wsSetIndex);
      const si = Number.isFinite(siRaw) ? Math.max(1, Math.trunc(siRaw)) : NaN;
      if (!Number.isFinite(si) || si <= 0) throw new Error("set_index required");

      const w = coerceNumber(wsWeight);
      if (w === null) throw new Error("weight required");

      const repsRaw = coerceNumber(wsReps);
      if (repsRaw === null) throw new Error("reps required");
      const reps = Math.max(0, Math.trunc(repsRaw));

      const volume = w * reps;

      const data: Record<string, any> = {
        date: date.trim(),
        exercise: ex,
        set_index: si,
        weight: w,
        reps,
        count: volume,
      };

      if (props.workout && wsWorkout.trim()) data.workout = wsWorkout.trim();

      const rpeNum = coerceNumber(wsRpe);
      if (props.rpe && rpeNum !== null) data.rpe = rpeNum;

      if (context.trim()) data.context = context.trim();
      if (notes.trim()) data.notes = notes.trim();

      const resp = await submitEntry(data);
      setStatus("saved");

      // Advance to next set; keep weight/reps for rapid capture
      setWsSetIndex(String(si + 1));

      // Refresh cached rows so dropdown + set index stay accurate
      try {
        await loadProgramRows(tv);
      } catch { }
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

  

  async function recordCount() {
    setStatus("");
    try {
      if (!programVersion) throw new Error("program not loaded");
      const props = schemaProps();
      if (!props.count) throw new Error('schema missing "count"');
      if (!date.trim()) throw new Error("date required");

      const data: Record<string, any> = {};
      if (date.trim()) data.date = date.trim();
      data.count = Math.max(0, Math.trunc(countStep || 1));

      if (context.trim()) data.context = context.trim();
      if (notes.trim()) data.notes = notes.trim();

      const resp = await submitEntry(data);
      setStatus("saved");
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

  async function recordDurationStop() {
    setStatus("");
    try {
      if (!programVersion) throw new Error("program not loaded");
      const props = schemaProps();
      const dk = durationKey(props);
      if (!dk) throw new Error('schema missing duration field (expected "duration_seconds")');
      if (!date.trim()) throw new Error("date required");

      const sec = stopDuration();

      const data: Record<string, any> = {};
      if (date.trim()) data.date = date.trim();
      data[dk] = Math.max(0, Math.trunc(sec));

      if (context.trim()) data.context = context.trim();
      if (notes.trim()) data.notes = notes.trim();

      const resp = await submitEntry(data);
      setStatus("saved");
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

  const mType = measurementType();
  const props = schemaProps();

  // Collect v0: treat context/notes as generic optional fields for count/duration programs.
  // Do not require the schema to declare them (backend stores arbitrary JSON).
  const showContext = mType === "count" || mType === "duration";
  const showNotes = showContext;

  const isWorkoutSet =
    mType === "count" && !!props.exercise && !!props.weight && !!props.reps && !!props.set_index;

  // ----------------------------
  // LifeSwitch workout library (local-only)
  // Used to drive Workout-plan -> Exercise options.
  // ----------------------------
  type WorkoutLibraryResp = {
    workouts: Array<{
      id: string;
      label: string;
      exercises: Array<{
        id: string;
        label?: string;
        planned_sets?: number;
        default_weight?: number;
        default_reps?: number;
        unit?: string;
      }>;
    }>;
  };

  const [workoutLib, setWorkoutLib] = React.useState<WorkoutLibraryResp | null>(null);
  const [workoutLibTried, setWorkoutLibTried] = React.useState(false);
  const [workoutLibErr, setWorkoutLibErr] = React.useState<string>("");

  // One-shot fetch when Workout Set is selected (schema has workout/exercise/etc.)
  React.useEffect(() => {
    if (!isWorkoutSet) return;
    if (!props.workout) return; // schema must support workout field
    if (workoutLibTried) return;

    setWorkoutLibTried(true);

    (async () => {
      try {
        const r = await fetch("/api/lifeswitch/workout_library", { cache: "no-store" });
        const t = await r.text().catch(() => "");
        if (!r.ok) throw new Error(`workout_library HTTP ${r.status} ${t}`);
        const j = JSON.parse(t) as WorkoutLibraryResp;
        setWorkoutLib(j);
        setWorkoutLibErr("");

        // Default workout plan if empty
        if (!wsWorkout.trim() && j?.workouts?.length) {
          setWsWorkout(String(j.workouts[0]?.id || ""));
        }
      } catch (e: any) {
        setWorkoutLib(null);
        setWorkoutLibErr(e?.message || String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkoutSet, props.workout, workoutLibTried]);

  const activeWorkoutPlan = React.useMemo(() => {
    const wid = String(wsWorkout || "").trim();
    if (!wid || !workoutLib?.workouts?.length) return null;
    return workoutLib.workouts.find((w) => String(w.id) === wid) || null;
  }, [wsWorkout, workoutLib]);

  // If a plan is selected and exercise is empty, default to the plan's first exercise
  React.useEffect(() => {
    if (!isWorkoutSet) return;
    const ex = String(wsExercise || "").trim();
    if (ex) return;
    const first = activeWorkoutPlan?.exercises?.[0]?.id;
    if (first) setWsExercise(String(first));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkoutSet, activeWorkoutPlan?.id]);

  const plannedExercises = React.useMemo(() => {
    const ws = (workoutLib?.workouts || []) as any[];
    const wid = String(wsWorkout || "").trim();
    const w = ws.find((x) => String(x?.id || "").trim() === wid);
    const exs = (w as any)?.exercises;
    const arr: any[] = Array.isArray(exs) ? exs : [];
    return arr
      .map((x) => ({
        id: String(x?.id || "").trim(),
        label: String(x?.label || "").trim(),
      }))
      .filter((x) => x.id);
  }, [workoutLib, wsWorkout]);

  const plannedExerciseIds = React.useMemo(() => plannedExercises.map((x) => x.id), [plannedExercises]);

  const plannedLabelById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const ex of plannedExercises) m.set(ex.id, ex.label || ex.id);
    return m;
  }, [plannedExercises]);

  const exerciseOptions = React.useMemo(() => {
    // Prefer the ordered plan (workout_library) when available.
    if (plannedExerciseIds.length) return plannedExerciseIds;

    // Fallback: unique exercises observed in entries.
    const set = new Set<string>();
    for (const r of Array.isArray(programRows) ? programRows : []) {
      const ex = String((r as any)?.data?.exercise || "").trim();
      if (ex) set.add(ex);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [plannedExerciseIds, programRows]);

  function exerciseLabel(id: string): string {
    const k = String(id || "").trim();
    if (!k) return "";
    return plannedLabelById.get(k) || k;
  }

  // Persisted exercise order per workout (local-only for now)
  const orderKey = React.useMemo(() => `vs_workout_order:${wsWorkout || ""}`, [wsWorkout]);

  const [exerciseOrder, setExerciseOrder] = React.useState<string[]>([]);

  // DnD sensors must be created at top-level (hooks cannot run inside JSX)
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  // When workout changes, load saved order; otherwise default to plan order
  React.useEffect(() => {
    const planIds = (activeWorkoutPlan?.exercises || []).map((e) => String(e.id));
    if (!wsWorkout || !planIds.length) {
      setExerciseOrder([]);
      return;
    }

    try {
      const raw = localStorage.getItem(orderKey) || "";
      const saved = raw ? (JSON.parse(raw) as string[]) : [];
      const savedFiltered = Array.isArray(saved) ? saved.filter((id) => planIds.includes(id)) : [];
      const missing = planIds.filter((id) => !savedFiltered.includes(id));
      const merged = [...savedFiltered, ...missing];
      setExerciseOrder(merged);
    } catch {
      setExerciseOrder(planIds);
    }
  }, [orderKey, wsWorkout, activeWorkoutPlan?.id]);

  // Persist whenever the order changes
  React.useEffect(() => {
    if (!wsWorkout) return;
    if (!exerciseOrder.length) return;
    try {
      localStorage.setItem(orderKey, JSON.stringify(exerciseOrder));
    } catch { }
  }, [orderKey, wsWorkout, exerciseOrder]);

  // Apply the order to plannedExercises
  const orderedPlannedExercises = React.useMemo(() => {
    const exs = plannedExercises || [];
    if (!exs.length) return exs;
    const byId = new Map(exs.map((e) => [String(e.id), e]));
    const out: typeof exs = [];

    if (exerciseOrder.length) {
      for (const id of exerciseOrder) {
        const it = byId.get(String(id));
        if (it) out.push(it);
      }
    }

    // Append anything missing (new exercises) deterministically
    for (const e of exs) {
      if (!out.find((x) => String(x.id) === String(e.id))) out.push(e);
    }

    return out;
  }, [plannedExercises, exerciseOrder]);

  const orderedExerciseIds = React.useMemo(
    () => orderedPlannedExercises.map((e) => String(e.id)),
    [orderedPlannedExercises]
  );

  const lastByExercise = React.useMemo(() => {
    const out = new Map<string, { weight?: number | null; reps?: number | null; rpe?: number | null }>();
    const rows = Array.isArray(programRows) ? programRows : [];
    const sorted = rows
      .slice()
      .sort((a, b) => String((b as any)?.occurred_at || "").localeCompare(String((a as any)?.occurred_at || "")));

    for (const r of sorted) {
      const d = (r as any)?.data || {};
      const ex = String(d.exercise || "").trim();
      if (!ex) continue;
      if (out.has(ex)) continue;
      out.set(ex, { weight: coerceNumber(d.weight), reps: coerceNumber(d.reps), rpe: coerceNumber(d.rpe) });
    }
    return out;
  }, [programRows]);

  function computeNextSetIndex(exercise: string, day: string, workout: string): number {
    const ex = String(exercise || "").trim();
    const d0 = String(day || "").trim();
    const w0 = String(workout || "").trim();
    if (!ex || !d0) return 1;

    let max = 0;
    for (const r of Array.isArray(programRows) ? programRows : []) {
      const d = (r as any)?.data || {};
      if (String(d.date || "").slice(0, 10) != d0) continue;
      if (String(d.exercise || "").trim() != ex) continue;
      if (props.workout && w0 && String(d.workout || "").trim() != w0) continue;

      const si = coerceNumber(d.set_index);
      if (typeof si === "number" && Number.isFinite(si)) max = Math.max(max, Math.trunc(si));
    }
    return max > 0 ? max + 1 : 1;
  }

  function clearWorkoutSetForExerciseChange() {
    setWsWeight("");
    setWsReps("");
    setWsRpe("");
    // wsSetIndex recalculates via the effect that calls computeNextSetIndex()
  }

  

  function gotoPlannedExercise(delta: number) {
    const ids = orderedExerciseIds; // canonical
    if (!ids.length) return;

    const cur = wsExercise.trim();
    const i = ids.indexOf(cur);
    if (i < 0) return;

    const j = i + delta;
    if (j < 0 || j >= ids.length) return;

    setWsExercise(ids[j]);
    clearWorkoutSetForExerciseChange();
  }

  function SortableExerciseRow({ id, label }: { id: string; label: string }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex w-full max-w-full items-center gap-2 rounded-xl border bg-background px-3 py-2"
      >
        <div className="min-w-0 flex-1 truncate text-sm">{label}</div>

        {/* Drag handle */}
        <button
          type="button"
          className="inline-flex h-8 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold cursor-grab select-none touch-none hover:bg-muted/60 active:cursor-grabbing"
          style={{ touchAction: "none" }}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          ⋮⋮
        </button>
      </div>
    );
  }

  React.useEffect(() => {
    if (!isWorkoutSet) return;
    if (!wsExercise.trim() && exerciseOptions.length) setWsExercise(exerciseOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkoutSet, exerciseOptions]);

  React.useEffect(() => {
    if (!isWorkoutSet) return;
    const ex = wsExercise.trim();
    if (!ex) return;

    const last = lastByExercise.get(ex);
    if (last) {
      if (!wsWeight.trim() && typeof last.weight === "number") setWsWeight(String(last.weight));
      if (!wsReps.trim() && typeof last.reps === "number") setWsReps(String(Math.trunc(last.reps)));
      if (!wsRpe.trim() && typeof last.rpe === "number") setWsRpe(String(last.rpe));
    }

    const next = computeNextSetIndex(ex, date, wsWorkout);
    setWsSetIndex(String(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkoutSet, wsExercise, date, wsWorkout, programRows]);

  const wsWeightNum = coerceNumber(wsWeight);
  const wsRepsNumRaw = coerceNumber(wsReps);
  const wsRepsNum = wsRepsNumRaw === null ? null : Math.max(0, Math.trunc(wsRepsNumRaw));
  const wsVolume = (wsWeightNum ?? 0) * (wsRepsNum ?? 0);

  const recentSets = React.useMemo(() => {
    if (!isWorkoutSet) return [];
    const day = String(date || "").slice(0, 10);
    if (!day) return [];

    const rows = Array.isArray(programRows) ? programRows : [];
    const out: Array<{ occurred_at: string; data: any }> = [];

    for (const r of rows) {
      const d = (r as any)?.data || {};
      if (String(d.date || "").slice(0, 10) !== day) continue;

      // If schema supports workout, only show sets from the selected workout plan
      if (props.workout && wsWorkout.trim()) {
        if (String(d.workout || "").trim() !== wsWorkout.trim()) continue;
      }

      out.push({ occurred_at: String((r as any)?.occurred_at || ""), data: d });
    }

    // newest first
    out.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    return out.slice(0, 50);
  }, [isWorkoutSet, programRows, date, props.workout, wsWorkout]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xl font-semibold">Capture</div>
          </div>

          {/* Actions (top-right) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60"
              onClick={refreshCapture}
            >
              Refresh
            </button>

            <button
              type="button"
              className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60"
              onClick={goBack}
              title="Back"
            >
              Back
            </button>
          </div>
        </div>

        {/* Program picker (below header) */}
        <div className="mt-3 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Program</div>
          <select
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={programVid}
            onChange={(e) => setProgramVid(e.target.value)}
          >
            <option value="">(choose)</option>
            {templates
              .filter((t) => {
                const vid = String(t.latest_version_id || "").trim();
                if (!vid) return false;
                if (vid === PHASE_TEMPLATE_VERSION_ID) return false;
                if (vid === CORRECTION_TEMPLATE_VERSION_ID) return false;
                return true;
              })
              .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
              .map((t) => (
                <option key={t.template_id} value={String(t.latest_version_id)}>
                  {(String(t.name || "").includes("Workout Set") ? "My workout" : t.name)} (v{t.latest_version ?? "?"})
                </option>
              ))}
          </select>
        </div>
        <div className="mt-4 rounded-xl border p-4">
          {!programVersion ? (
            <div className="text-sm text-muted-foreground">Select a program to begin.</div>
          ) : (
            <>
              <div className="text-sm font-semibold">
                {String(programVersion.json_schema?.title || "Program")} · measurement={mType || "unknown"}
              </div>

              {!isWorkoutSet ? (
                <>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {props.date ? (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</div>
                        <input
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                        />
                      </div>
                    ) : null}

                    {showContext ? (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Context</div>
                        <input
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                          value={context}
                          onChange={(e) => setContext(e.target.value)}
                          placeholder="home"
                        />
                      </div>
                    ) : null}
                  </div>

                  {showNotes ? (
                    <div className="mt-3 space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</div>
                      <textarea
                        className="h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="optional"
                      />
                    </div>
                  ) : null}
                </>
              ) : null}

              {isWorkoutSet ? (
                <div className="mt-4">
                  {props.workout ? (
                    <div className="mt-3 space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workout</div>

                      {workoutLib?.workouts?.length ? (
                        <select
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                          value={wsWorkout}
                          onChange={(e) => {
                            const v = e.target.value;
                            setWsWorkout(v);
                            setWsExercise("");
                            setWsWorkout(e.target.value);
                            clearWorkoutSetForExerciseChange();
                            setIsReordering(false);
                          }}
                        >
                          {workoutLib.workouts.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                          value={wsWorkout}
                          onChange={(e) => {
                            setWsWorkout(e.target.value);
                            clearWorkoutSetForExerciseChange();
                          }}
                          placeholder="push_a"
                        />
                      )}

                      {workoutLibErr ? <div className="text-xs text-muted-foreground">workout_library: {workoutLibErr}</div> : null}
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exercise</div>

                      {plannedExercises.length ? (
                        <>
                          <select
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                            value={wsExercise}
                            onChange={(e) => {
                              setWsExercise(e.target.value);
                              clearWorkoutSetForExerciseChange();
                              setIsReordering(false);
                            }}
                          >
                            {plannedExercises.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                {exerciseLabel(ex.id)}
                              </option>
                            ))}
                          </select>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-lg bg-muted px-3 py-2 text-xs font-semibold hover:bg-muted/60 disabled:opacity-40"
                              onClick={() => gotoPlannedExercise(-1)}
                              disabled={orderedExerciseIds.indexOf(wsExercise.trim()) <= 0}
                              title="Previous exercise"
                            >
                              Prev
                            </button>

                            <button
                              type="button"
                              className="rounded-lg bg-muted px-3 py-2 text-xs font-semibold hover:bg-muted/60 disabled:opacity-40"
                              onClick={() => gotoPlannedExercise(1)}
                              disabled={
                                orderedExerciseIds.indexOf(wsExercise.trim()) < 0 ||
                                orderedExerciseIds.indexOf(wsExercise.trim()) >= orderedExerciseIds.length - 1
                              }
                              title="Next exercise"
                            >
                              Next
                            </button>

                            <button
                              type="button"
                              className="rounded-lg bg-muted px-3 py-2 text-xs font-semibold hover:bg-muted/60 disabled:opacity-40"
                              onClick={() => setIsReordering((v) => !v)}
                              disabled={!orderedExerciseIds.length}
                              title="Reorder exercises"
                            >
                              {isReordering ? "Done" : "Edit order"}
                            </button>
                          </div>

                          {isReordering && orderedExerciseIds.length ? (
                            <div className="mt-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Reorder exercises (drag)
                              </div>

                              <DndContext
                                sensors={dndSensors}
                                collisionDetection={closestCenter}
                                onDragEnd={(ev: DragEndEvent) => {
                                  const activeId = String(ev.active?.id || "");
                                  const overId = String(ev.over?.id || "");
                                  if (!activeId || !overId || activeId === overId) return;

                                  setExerciseOrder((prev) => {
                                    const ids = prev.length ? prev.slice() : plannedExerciseIds.slice();
                                    const oldIndex = ids.indexOf(activeId);
                                    const newIndex = ids.indexOf(overId);
                                    if (oldIndex < 0 || newIndex < 0) return ids;
                                    return arrayMove(ids, oldIndex, newIndex);
                                  });
                                }}
                              >
                                <SortableContext items={orderedExerciseIds} strategy={verticalListSortingStrategy}>
                                  <div className="mt-2 space-y-2">
                                    {orderedExerciseIds.map((id) => (
                                      <SortableExerciseRow key={id} id={id} label={exerciseLabel(id)} />
                                    ))}
                                  </div>
                                </SortableContext>
                              </DndContext>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <input
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                            list="vs_exercise_options"
                            value={wsExercise}
                            onChange={(e) => {
                              setWsExercise(e.target.value);
                              setIsReordering(false);
                            }}
                            placeholder="bench_press"
                          />
                          <datalist id="vs_exercise_options">
                            {exerciseOptions.map((x) => (
                              <option key={x} value={x} />
                            ))}
                          </datalist>
                        </>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Set</div>
                      <input
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        type="number"
                        min={1}
                        value={wsSetIndex}
                        onChange={(e) => setWsSetIndex(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weight</div>
                      <input
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        type="number"
                        inputMode="decimal"
                        value={wsWeight}
                        onChange={(e) => setWsWeight(e.target.value)}
                        placeholder="lb"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reps</div>
                      <input
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        type="number"
                        min={0}
                        value={wsReps}
                        onChange={(e) => setWsReps(e.target.value)}
                        placeholder="reps"
                      />
                    </div>
                  </div>

                  {props.rpe ? (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={wsRpe.trim() === "10"}
                        onChange={(e) => setWsRpe(e.target.checked ? "10" : "")}
                      />
                      <span className="text-muted-foreground">Failure (RPE 10)</span>
                    </div>
                  ) : null}

                  <div className="mt-3 text-sm text-muted-foreground">
                    Volume (count) = {Number.isFinite(wsVolume) ? Math.round(wsVolume) : "?"}{" "}
                    {String(((programVersion as any)?.metadata?.graph_spec_v0?.y?.unit || "") as any)}
                    {loadingProgramRows ? " · syncing…" : ""}
                  </div>

                  <button
                    className="mt-3 w-full rounded-2xl bg-muted px-4 py-5 text-lg font-semibold hover:bg-muted/60 disabled:opacity-40"
                    onClick={recordWorkoutSet}
                    disabled={
                      !date.trim() ||
                      !wsExercise.trim() ||
                      coerceNumber(wsWeight) === null ||
                      coerceNumber(wsReps) === null ||
                      !extractUuid(programVid)
                    }
                    title="Submit this set (append-only)"
                  >
                    Submit set
                  </button>
                  {recentSets.length ? (
                    <div className="mt-3 rounded-xl border bg-background p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Today’s sets
                      </div>

                      <div className="mt-2 space-y-1">
                        {recentSets.map((r, idx) => {
                          const d = r.data || {};
                          const ex = String(d.exercise || "").trim();
                          const wt = coerceNumber(d.weight);
                          const reps = coerceNumber(d.reps);
                          const si = coerceNumber(d.set_index);
                          const note = String(d.notes || "").trim();
                          const rpe = coerceNumber(d.rpe);

                          const left = `${si ? `Set ${Math.trunc(si)}` : `Set`} · ${exerciseLabel(ex) || ex || "(exercise)"}`;
                          const mid = `${wt !== null ? wt : "?"} × ${reps !== null ? Math.trunc(reps) : "?"}`;
                          const rightParts: string[] = [];
                          if (rpe !== null) rightParts.push(rpe >= 10 ? "Failure" : `RPE ${rpe}`);
                          if (note) rightParts.push(note);

                          return (
                            <div key={`${r.occurred_at}-${idx}`} className="flex items-start justify-between gap-3 text-sm">
                              <div className="min-w-0 flex-1">
                                <div className="truncate">{left}</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">{mid}{rightParts.length ? ` · ${rightParts.join(" · ")}` : ""}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-2 text-xs text-muted-foreground">
                    Stores: date, exercise, set_index, weight, reps, count (=weight×reps){props.workout ? ", workout" : ""}.
                  </div>
                </div>
              ) : mType === "count" ? (
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">Step</div>
                    <input
                      className="w-24 rounded-xl border bg-background px-3 py-2 text-sm"
                      type="number"
                      min={1}
                      value={countStep}
                      onChange={(e) => setCountStep(Math.max(1, Math.trunc(Number(e.target.value) || 1)))}
                    />
                  </div>

                  <button
                    className="mt-3 w-full rounded-2xl bg-muted px-4 py-5 text-lg font-semibold hover:bg-muted/60"
                    onClick={recordCount}
                    disabled={!subjectId.trim() || !extractUuid(programVid) || (props.date && !date.trim())}
                    title="Record one count event"
                  >
                    Record
                  </button>

                  <div className="mt-2 text-xs text-muted-foreground">
                    Writes: owner_user_id + subject_id + template_version_id + data (date/count/context/notes).
                  </div>
                </div>
              ) : mType === "duration" ? (
                <div className="mt-4">
                  <div className="text-sm text-muted-foreground">Duration: {durationSec}s</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="flex-1 rounded-xl bg-muted px-3 py-3 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
                      onClick={startDuration}
                      disabled={durationRunning}
                    >
                      Start
                    </button>
                    <button
                      className="flex-1 rounded-xl bg-muted px-3 py-3 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
                      onClick={recordDurationStop}
                      disabled={!durationRunning}
                      title="Stop and write entry"
                    >
                      Stop + Save
                    </button>
                    <button
                      className="rounded-xl bg-muted px-3 py-3 text-sm font-semibold hover:bg-muted/60"
                      onClick={resetDuration}
                    >
                      Reset
                    </button>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    Stop writes the entry; measurements are append-only.
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-muted-foreground">
                  Collect v0 supports measurement types <code>count</code> and <code>duration</code>.
                </div>
              )}
            </>
          )}
        </div>

        {status && status.toLowerCase().startsWith("error") ? (
          <div className="mt-3 text-sm text-muted-foreground">{status}</div>
        ) : null}
      </div>
    </div>
  );
}
