"use client";

import { authFetch } from "@/lib/authFetch";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Plus } from "lucide-react";
import { selectNumberInputValue } from "@/components/lifeswitch/selectInputValue";

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
  display_name_snapshot?: string | null;
  sort_order: number;
  set_type?: "straight" | "drop" | string;
  planned_sets: number;
  default_weight: number;
  default_reps: number;
  flags?: string | null;
  created_at: string;
  updated_at: string;
};

type ExerciseSearchHit = {
  exercise_id: string;
  display_name: string;
  kind: string;
  modality: string;
  brand_name?: string | null;
  model_name?: string | null;
  matched_source?: string | null;
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

type DraftSetSegmentRow = {
  segment_index: number;
  label: string;
  weight: string;
  reps: string;
  notes: string;
};

type DraftSetRow = {
  draft_id: string;
  exercise_id: string;
  exercise_name: string;
  exercise_sort_order: number;
  set_index: number;
  set_type: string;
  segments?: DraftSetSegmentRow[];
  weight: string;
  reps: string;
  flags: string;
  done: boolean;
};

type TrainingSessionRow = {
  training_session_id: string;
  workout_template_id?: string | null;
  day: string;
  name: string;
  created_at: string;
  is_active?: boolean;
};

type TrainingSetLogRow = {
  training_set_log_id: string;
  training_session_id: string;
  exercise_id: string;
  exercise_name: string;
  exercise_sort_order: number;
  set_index: number;
  set_type?: string | null;
  weight: number;
  reps: number;
  volume: number;
  flags?: string | null;
  notes?: string | null;
};

type TrainingSetLogSegmentRow = {
  training_set_log_segment_id?: string;
  training_set_log_id: string;
  segment_index: number;
  label?: string | null;
  weight: number;
  reps: number;
  volume: number;
  notes?: string | null;
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

const TRAINING_CAPTURE_DRAFT_KEY = "lifeswitch:training:capture:draft:v1";

type TrainingCaptureLocalDraft = {
  day: string;
  selectedId: string;
  draftRows: DraftSetRow[];
  prefillSource?: string;
  savedAt?: string;
};

function isDraftSetRows(x: any): x is DraftSetRow[] {
  return Array.isArray(x) && x.every((row) => row && typeof row === "object" && typeof row.draft_id === "string");
}

function formatSavedAt(savedAt: string) {
  if (!savedAt) return "";
  const d = new Date(savedAt);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function TrainingCapturePage() {
  const router = useRouter();

  const [day, setDay] = React.useState(todayLocalYYYYMMDD());
  const [templates, setTemplates] = React.useState<WorkoutTemplateRow[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [showWorkoutSetup, setShowWorkoutSetup] = React.useState(false);
  const [templateExercises, setTemplateExercises] = React.useState<WorkoutTemplateExerciseRow[]>([]);
  const [myExercises, setMyExercises] = React.useState<MyExerciseRow[]>([]);

  const [loadingTemplates, setLoadingTemplates] = React.useState(false);
  const [loadingTemplateExercises, setLoadingTemplateExercises] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [flash, setFlash] = React.useState("");
  const [draftRows, setDraftRows] = React.useState<DraftSetRow[]>([]);
  const [finishLoading, setFinishLoading] = React.useState(false);
  const [prefillSource, setPrefillSource] = React.useState("Select a workout template to begin");
  const [restoredLocalDraft, setRestoredLocalDraft] = React.useState(false);
  const [draftSavedAt, setDraftSavedAt] = React.useState("");
  const [openExerciseOptionsId, setOpenExerciseOptionsId] = React.useState("");
  const [openAddExerciseId, setOpenAddExerciseId] = React.useState("");
  const [exerciseSearch, setExerciseSearch] = React.useState("");
  const [catalogHits, setCatalogHits] = React.useState<ExerciseSearchHit[]>([]);
  const [catalogLoading, setCatalogLoading] = React.useState(false);

  const selected = React.useMemo(() => {
    return templates.find((t) => t.workout_template_id === selectedId) || null;
  }, [templates, selectedId]);

  const myExercisesById = React.useMemo(() => {
    const m = new Map<string, MyExerciseRow>();
    for (const row of myExercises) m.set(row.exercise_id, row);
    return m;
  }, [myExercises]);

  const doneRows = React.useMemo(() => draftRows.filter((r) => r.done), [draftRows]);

  const summary = React.useMemo(() => {
    let setCount = 0;
    let volume = 0;
    const exercises = new Set<string>();

    for (const r of doneRows) {
      const rowVolume =
        r.set_type === "drop"
          ? (r.segments || []).reduce((sum, seg) => sum + safeNum(seg.weight, 0) * safeNum(seg.reps, 0), 0)
          : safeNum(r.weight, 0) * safeNum(r.reps, 0);

      if (rowVolume <= 0) continue;

      setCount += 1;
      volume += rowVolume;
      exercises.add(r.exercise_id);
    }

    return {
      setCount,
      exerciseCount: exercises.size,
      volume,
    };
  }, [doneRows]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TRAINING_CAPTURE_DRAFT_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<TrainingCaptureLocalDraft>;
      if (!parsed?.selectedId || !isDraftSetRows(parsed.draftRows) || !parsed.draftRows.length) return;

      setDay(String(parsed.day || todayLocalYYYYMMDD()));
      setSelectedId(String(parsed.selectedId || ""));
      setDraftRows(parsed.draftRows);
      setPrefillSource(parsed.prefillSource || "Restored unfinished workout draft");
      setRestoredLocalDraft(true);
      setDraftSavedAt(formatSavedAt(String(parsed.savedAt || "")));
      setFlash("Restored unfinished workout draft");
    } catch {
      // ignore invalid local draft data
    }
  }, []);

  React.useEffect(() => {
    if (!selectedId || !draftRows.length) return;

    try {
      const savedAt = new Date().toISOString();
      const payload: TrainingCaptureLocalDraft = {
        day,
        selectedId,
        draftRows,
        prefillSource,
        savedAt,
      };

      window.localStorage.setItem(TRAINING_CAPTURE_DRAFT_KEY, JSON.stringify(payload));
      setDraftSavedAt(formatSavedAt(savedAt));
    } catch {
      // local autosave is best-effort
    }
  }, [day, selectedId, draftRows, prefillSource]);

  React.useEffect(() => {
    // Draft persistence is handled by localStorage autosave above.
    // Avoid beforeunload warnings because internal LifeSwitch navigation
    // (Strength ↔ Conditioning) should not feel like abandoning work.
    return;
  }, []);

  async function loadTemplates() {
    setLoadingTemplates(true);
    setStatus("");

    try {
      const list = (await fetchJson("/api/lifeswitch/training/workout_templates")) as WorkoutTemplateRow[];
      const active = Array.isArray(list) ? list.filter((x) => x?.is_active) : [];

      setTemplates(active);
    } catch (e: any) {
      setTemplates([]);
      setStatus(String(e?.message || e));
    } finally {
      setLoadingTemplates(false);
    }
  }

  React.useEffect(() => {
    const q = exerciseSearch.trim();

    if (!q) {
      setCatalogHits([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setCatalogLoading(true);

      try {
        const url = new URL(
          "/api/catalog/exercises/search",
          window.location.origin
        );

        url.searchParams.set("q", q);
        url.searchParams.set("limit", "10");

        const rows = (await fetchJson(url.toString())) as ExerciseSearchHit[];

        setCatalogHits(Array.isArray(rows) ? rows : []);
      } catch {
        setCatalogHits([]);
      } finally {
        setCatalogLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [exerciseSearch]);

  async function loadMyExercises() {
    try {
      const list = (await fetchJson("/api/lifeswitch/training/my_exercises")) as MyExerciseRow[];
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

  async function loadTemplateExerciseSegments(workoutTemplateExerciseId: string): Promise<DraftSetSegmentRow[]> {
    try {
      const rows = (await fetchJson(
        `/api/lifeswitch/training/workout_template_exercises/${encodeURIComponent(workoutTemplateExerciseId)}/segments`
      )) as Array<{
        segment_index: number;
        label?: string | null;
        default_weight: number;
        default_reps: number;
      }>;

      const arr = Array.isArray(rows) ? rows.slice() : [];
      arr.sort((a, b) => safeNum(a.segment_index, 0) - safeNum(b.segment_index, 0));

      return arr.map((seg) => ({
        segment_index: safeNum(seg.segment_index, 0),
        label: safeNum(seg.segment_index, 0) === 1 ? "Start" : `Drop ${safeNum(seg.segment_index, 1) - 1}`,
        weight: String(safeNum(seg.default_weight, 0)),
        reps: String(safeNum(seg.default_reps, 0) || ""),
        notes: "",
      }));
    } catch {
      return [];
    }
  }

  async function loadLastSessionDraftRows(
    workoutTemplateId: string,
    templateRows: WorkoutTemplateExerciseRow[]
  ): Promise<Map<string, DraftSetRow[]>> {
    const result = new Map<string, DraftSetRow[]>();

    try {
      const sessions = (await fetchJson("/api/lifeswitch/training/sessions?limit=100")) as TrainingSessionRow[];
      const latest = (Array.isArray(sessions) ? sessions : [])
        .filter((session) => String(session.workout_template_id || "") === workoutTemplateId)
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];

      if (!latest?.training_session_id) return result;

      const setRows = (await fetchJson(
        `/api/lifeswitch/training/sessions/${encodeURIComponent(latest.training_session_id)}/sets`
      )) as TrainingSetLogRow[];

      const sortedSets = (Array.isArray(setRows) ? setRows : []).slice().sort((a, b) => {
        const c = safeNum(a.exercise_sort_order, 0) - safeNum(b.exercise_sort_order, 0);
        if (c !== 0) return c;
        return safeNum(a.set_index, 0) - safeNum(b.set_index, 0);
      });

      const templateByExercise = new Map<string, WorkoutTemplateExerciseRow>();
      for (const row of templateRows) {
        templateByExercise.set(row.exercise_id, row);
      }

      for (const setRow of sortedSets) {
        const template = templateByExercise.get(setRow.exercise_id);
        if (!template) continue;

        const setType = String(setRow.set_type || template.set_type || "straight").toLowerCase();

        let segments: DraftSetSegmentRow[] | undefined = undefined;
        if (setType === "drop") {
          const segRows = (await fetchJson(
            `/api/lifeswitch/training/sessions/${encodeURIComponent(latest.training_session_id)}/sets/${encodeURIComponent(setRow.training_set_log_id)}/segments`
          )) as TrainingSetLogSegmentRow[];

          const sortedSegs = (Array.isArray(segRows) ? segRows : []).slice().sort(
            (a, b) => safeNum(a.segment_index, 0) - safeNum(b.segment_index, 0)
          );

          segments = sortedSegs.map((seg) => ({
            segment_index: safeNum(seg.segment_index, 0),
            label: seg.label || (safeNum(seg.segment_index, 0) === 1 ? "Start" : `Drop ${safeNum(seg.segment_index, 1) - 1}`),
            weight: String(safeNum(seg.weight, 0)),
            reps: String(safeNum(seg.reps, 0) || ""),
            notes: seg.notes || "",
          }));
        }

        const draft: DraftSetRow = {
          draft_id: makeDraftId(setRow.exercise_id, safeNum(setRow.set_index, 0)),
          exercise_id: setRow.exercise_id,
          exercise_name: setRow.exercise_name || setRow.exercise_id,
          exercise_sort_order: safeNum(setRow.exercise_sort_order, template.sort_order || 0),
          set_index: safeNum(setRow.set_index, 0),
          set_type: setType,
          segments,
          weight: String(safeNum(setRow.weight, 0)),
          reps: String(safeNum(setRow.reps, 0) || ""),
          flags: setRow.flags || "",
          done: false,
        };

        const arr = result.get(setRow.exercise_id) || [];
        arr.push(draft);
        result.set(setRow.exercise_id, arr);
      }
    } catch {
      return result;
    }

    return result;
  }

  async function buildDraftRows(rows: WorkoutTemplateExerciseRow[], workoutTemplateIdOverride?: string) {
    const out: DraftSetRow[] = [];
    let usedLastSession = false;
    const workoutTemplateId = workoutTemplateIdOverride || selectedId;
    const lastRowsByExercise = workoutTemplateId
      ? await loadLastSessionDraftRows(workoutTemplateId, rows)
      : new Map<string, DraftSetRow[]>();

    for (const ex of rows) {
      const meta = myExercisesById.get(ex.exercise_id);
      const exerciseName = ex.display_name_snapshot || meta?.display_name || ex.exercise_id;
      const plannedSets = Math.max(0, Math.floor(safeNum(ex.planned_sets, 0)));
      const setType = String(ex.set_type || "straight").toLowerCase();
      const previousRows = lastRowsByExercise.get(ex.exercise_id) || [];
      let nextSetIndex = 1;

      if (previousRows.length) {
        usedLastSession = true;

        for (const prev of previousRows) {
          if (String(prev.set_type || "").toLowerCase() === "drop" && (prev.segments || []).length) {
            for (const seg of prev.segments || []) {
              out.push({
                draft_id: makeDraftId(prev.exercise_id, nextSetIndex),
                exercise_id: prev.exercise_id,
                exercise_name: exerciseName,
                exercise_sort_order: safeNum(ex.sort_order, prev.exercise_sort_order),
                set_index: nextSetIndex,
                set_type: "straight",
                segments: undefined,
                weight: String(safeNum(seg.weight, 0)),
                reps: String(safeNum(seg.reps, 0)),
                flags: [prev.flags, seg.label].filter(Boolean).join(" · "),
                done: false,
              });
              nextSetIndex += 1;
            }
            continue;
          }

          out.push({
            ...prev,
            draft_id: makeDraftId(prev.exercise_id, nextSetIndex),
            exercise_name: exerciseName,
            exercise_sort_order: safeNum(ex.sort_order, prev.exercise_sort_order),
            set_index: nextSetIndex,
            set_type: "straight",
            segments: undefined,
            done: false,
          });
          nextSetIndex += 1;
        }
        continue;
      }

      if (setType === "drop") {
        const templateSegments = await loadTemplateExerciseSegments(ex.workout_template_exercise_id);
        const segments = templateSegments.length
          ? templateSegments
          : [{
              segment_index: 1,
              label: "Start",
              weight: String(safeNum(ex.default_weight, 0)),
              reps: String(safeNum(ex.default_reps, 0)),
              notes: "",
            }];

        for (let i = 1; i <= plannedSets; i++) {
          for (const seg of segments) {
            out.push({
              draft_id: makeDraftId(ex.exercise_id, nextSetIndex),
              exercise_id: ex.exercise_id,
              exercise_name: exerciseName,
              exercise_sort_order: safeNum(ex.sort_order, 0),
              set_index: nextSetIndex,
              set_type: "straight",
              segments: undefined,
              weight: String(safeNum(seg.weight, 0)),
              reps: String(safeNum(seg.reps, 0)),
              flags: [ex.flags, seg.label].filter(Boolean).join(" · "),
              done: false,
            });
            nextSetIndex += 1;
          }
        }

        continue;
      }

      for (let i = 1; i <= plannedSets; i++) {
        out.push({
          draft_id: makeDraftId(ex.exercise_id, i),
          exercise_id: ex.exercise_id,
          exercise_name: exerciseName,
          exercise_sort_order: safeNum(ex.sort_order, 0),
          set_index: i,
          set_type: "straight",
          segments: undefined,
          weight: String(safeNum(ex.default_weight, 0)),
          reps: String(safeNum(ex.default_reps, 0)),
          flags: ex.flags || "",
          done: false,
        });
      }
    }

    setDraftRows(out);
    setPrefillSource(usedLastSession ? "Prefilled from last logged session" : "Using workout template defaults");
  }

  React.useEffect(() => {
    void loadTemplates();
    void loadMyExercises();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!selectedId) return;
    if (restoredLocalDraft) return;
    void loadTemplateExercises(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, myExercisesById, restoredLocalDraft]);

  function updateDraftRow(draftId: string, patch: Partial<DraftSetRow>) {
    setDraftRows((prev) => prev.map((r) => (r.draft_id === draftId ? { ...r, ...patch } : r)));
  }

  function updateDraftSegment(draftId: string, segmentIndex: number, patch: Partial<DraftSetSegmentRow>) {
    setDraftRows((prev) =>
      prev.map((row) => {
        if (row.draft_id !== draftId) return row;
        const segments = (row.segments || []).map((seg) =>
          seg.segment_index === segmentIndex ? { ...seg, ...patch } : seg
        );
        return { ...row, segments };
      })
    );
  }

  function clearLocalDraftStorage() {
    try {
      window.localStorage.removeItem(TRAINING_CAPTURE_DRAFT_KEY);
    } catch {
      // ignore
    }
  }

  function discardLocalDraft() {
    clearLocalDraftStorage();
    setSelectedId("");
    setTemplateExercises([]);
    setDraftRows([]);
    setPrefillSource("Select a workout template to begin");
    setRestoredLocalDraft(false);
    setDraftSavedAt("");
    setFlash("Discarded unfinished workout draft");
    setStatus("");
  }

  function removeExerciseFromDraft(exerciseId: string) {
    setDraftRows((prev) => prev.filter((row) => row.exercise_id !== exerciseId));
    setOpenExerciseOptionsId("");
  }
  async function saveCatalogExerciseToMyExercises(hit: ExerciseSearchHit) {
    const qs = new URLSearchParams();

    qs.set("exercise_id", hit.exercise_id);
    qs.set("display_name", hit.display_name);
    qs.set("kind", hit.kind || "strength");
    qs.set("modality", hit.modality || "custom");

    if (hit.brand_name) {
      qs.set("brand_name", hit.brand_name);
    }

    if (hit.model_name) {
      qs.set("model_name", hit.model_name);
    }

    if (hit.matched_source) {
      qs.set("matched_source", hit.matched_source);
    }

    await fetchJson(`/api/lifeswitch/training/my_exercises/upsert?${qs.toString()}`, {
      method: "POST",
    });
  }


  function addExerciseToDraft(afterExerciseId: string, exercise: MyExerciseRow) {
    setDraftRows((prev) => {
      const matchingRows = prev.filter((row) => row.exercise_id === afterExerciseId);

      if (!matchingRows.length) return prev;

      const lastRowIndex = prev.findIndex(
        (row) => row.draft_id === matchingRows[matchingRows.length - 1].draft_id
      );

      const nextSortOrder =
        matchingRows[0].exercise_sort_order + 0.1;

      const newRow: DraftSetRow = {
        draft_id: makeDraftId(exercise.exercise_id, 1),
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.display_name,
        exercise_sort_order: nextSortOrder,
        set_index: 1,
        set_type: "straight",
        weight: "0",
        reps: "0",
        flags: "",
        done: false,
      };

      const copy = prev.slice();
      copy.splice(
        prev.findIndex((row) => row.exercise_id === afterExerciseId),
        0,
        newRow
      );

      return copy;
    });

    setOpenAddExerciseId("");
    setOpenExerciseOptionsId("");
    setExerciseSearch("");
  }

  function addSetAfter(row: DraftSetRow) {
    const sameExercise = draftRows.filter((r) => r.exercise_id === row.exercise_id);
    const nextIndex = sameExercise.length ? Math.max(...sameExercise.map((r) => r.set_index)) + 1 : 1;

    const next: DraftSetRow = {
      ...row,
      draft_id: makeDraftId(row.exercise_id, nextIndex),
      set_index: nextIndex,
      done: false,
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

  async function finishSession() {
    if (!selected) return;

    const validRows = doneRows.filter((r) => {
      if (r.set_type === "drop") {
        return (r.segments || []).some((seg) => safeNum(seg.weight, 0) >= 0 && safeNum(seg.reps, 0) > 0);
      }

      const weight = safeNum(r.weight, 0);
      const reps = safeNum(r.reps, 0);
      return Number.isFinite(weight) && weight >= 0 && Number.isFinite(reps) && reps > 0;
    });

    if (!validRows.length) {
      setStatus("no completed sets to finish");
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
        const isDrop = row.set_type === "drop";
        const segments = (row.segments || []).filter((seg) => safeNum(seg.reps, 0) > 0);
        const firstSegment = segments[0] || null;

        const setResult = await fetchJson(`/api/lifeswitch/training/sessions/${encodeURIComponent(sessionId)}/sets/add`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workout_template_id: selected.workout_template_id,
            exercise_id: row.exercise_id,
            exercise_name: row.exercise_name,
            exercise_sort_order: row.exercise_sort_order,
            set_index: row.set_index,
            set_type: isDrop ? "drop" : "straight",
            weight: isDrop ? safeNum(firstSegment?.weight, 0) : safeNum(row.weight, 0),
            reps: isDrop ? safeNum(firstSegment?.reps, 0) : safeNum(row.reps, 0),
            flags: row.flags || "",
            notes: "",
          }),
        });

        const setLogId = String(
          setResult?.training_set_log_id ||
          setResult?.set_id ||
          setResult?.id ||
          ""
        );

        if (isDrop) {
          if (!setLogId) throw new Error("missing training_set_log_id for drop set");

          for (const seg of segments) {
            await fetchJson(
              `/api/lifeswitch/training/sessions/${encodeURIComponent(sessionId)}/sets/${encodeURIComponent(setLogId)}/segments/add`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  segment_index: seg.segment_index,
                  label: seg.label,
                  weight: safeNum(seg.weight, 0),
                  reps: safeNum(seg.reps, 0),
                  notes: seg.notes || "",
                }),
              }
            );
          }
        }
      }

      clearLocalDraftStorage();
      setRestoredLocalDraft(false);
      setDraftSavedAt("");
      setFlash(`Finished ${selected.name}: ${validRows.length} sets logged`);
      setStatus("");

      window.setTimeout(() => {
        router.push("/lifeswitch/training/calendar");
      }, 700);
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



  const setupOpen = !draftRows.length;

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Training · Capture</div>
        </div>

        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="rounded-xl border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border text-sm">
        <div className="bg-muted px-3 py-2 text-center font-semibold">Strength</div>
        <a
          href="/lifeswitch/training/capture/conditioning"
          className="px-3 py-2 text-center hover:bg-muted/30"
        >
          Conditioning
        </a>
      </div>

      {flash ? <div className="mt-3 text-sm text-green-600">{flash}</div> : null}
      {status ? <div className="mt-3 text-sm text-red-600">{status}</div> : null}

      <div className="mt-6 grid gap-4">
        {setupOpen ? (
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
            onChange={(e) => {
              setRestoredLocalDraft(false);
              setTemplateExercises([]);
              setDraftRows([]);
              setSelectedId(e.target.value);
            }}
          >
            <option value="">Select workout</option>
            {templates.map((t) => (
              <option key={t.workout_template_id} value={t.workout_template_id}>
                {t.name}
              </option>
            ))}
          </select>

          {selected ? null : templates.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">
              No workout templates yet. Create one in Workouts.
            </div>
          ) : null}

          </aside>
        ) : null}

        <main className={draftRows.length || loadingTemplateExercises ? "rounded-xl border p-4" : "hidden"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold">Active session draft</div>

            <div className="flex flex-wrap items-center gap-2">
              {draftRows.length ? (
                <button
                  type="button"
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30"
                  onClick={discardLocalDraft}
                  disabled={finishLoading}
                >
                  Discard draft
                </button>
              ) : null}

              <button
                type="button"
                className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                onClick={() => void finishSession()}
                disabled={!selected || finishLoading || summary.setCount === 0}
              >
                {finishLoading ? "Finishing..." : "Finish Session"}
              </button>
            </div>
          </div>

          {draftRows.length ? (
            <div className="mt-4 space-y-5">
              {byExercise.map((block) => {
                const first = block.rows[0];

                return (
                  <section key={block.key} className="rounded-xl border p-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold">{first.exercise_name}</div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {block.rows.filter((r) => r.done).length} completed sets
                        </div>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-lg hover:bg-muted/30"
                          onClick={() =>
                            setOpenExerciseOptionsId((prev) =>
                              prev === first.exercise_id ? "" : first.exercise_id
                            )
                          }
                        >
                          + 
                        </button>

                        {openExerciseOptionsId === first.exercise_id ? (
                          <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border bg-background p-2 shadow-lg">
                            <button
                              type="button"
                              className="w-full rounded-md border px-2 py-1 text-xs hover:bg-muted/30"
                              onClick={() => addSetAfter(block.rows[block.rows.length - 1])}
                            >
                              + Add Set
                            </button>

                            <button
                              type="button"
                              className="mt-2 w-full rounded-md border px-2 py-1 text-xs hover:bg-muted/30"
                              onClick={() => {
                                setOpenAddExerciseId(first.exercise_id);
                                setExerciseSearch("");
                              }}
                            >
                              Add Exercise
                            </button>
                            {openAddExerciseId === first.exercise_id ? (
                              <div className="mt-2">
                                <input
                                  className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                                  placeholder="Search exercises"
                                  value={exerciseSearch}
                                  onChange={(e) => setExerciseSearch(e.target.value)}
                                />

                                <div className="mt-2 max-h-56 overflow-y-auto space-y-1">
                                  {myExercises
                                    .filter((x) =>
                                      x.display_name
                                        .toLowerCase()
                                        .includes(exerciseSearch.toLowerCase())
                                    )
                                    .slice(0, 10)
                                    .map((exercise) => (
                                      <button
                                        key={exercise.exercise_id}
                                        type="button"
                                        className="w-full rounded-md border px-2 py-1 text-left text-xs hover:bg-muted/30"
                                        onClick={() =>
                                          addExerciseToDraft(first.exercise_id, exercise)
                                        }
                                      >
                                        {exercise.display_name}
                                      </button>
                                    ))}
                                </div>

                                <div className="mt-3 text-[11px] font-semibold text-muted-foreground">
                                  Catalog
                                </div>

                                <div className="mt-1 max-h-56 overflow-y-auto space-y-1">
                                  {catalogHits.map((hit) => (
                                    <button
                                      key={hit.exercise_id}
                                      type="button"
                                      className="w-full rounded-md border px-2 py-1 text-left text-xs hover:bg-muted/30"
                                      onClick={() =>
                                        addExerciseToDraft(first.exercise_id, {
                                          my_exercise_id: "",
                                          owner_user_id: "",
                                          exercise_id: hit.exercise_id,
                                          display_name: hit.display_name,
                                          kind: hit.kind,
                                          modality: hit.modality,
                                          brand_name: hit.brand_name,
                                          model_name: hit.model_name,
                                          is_active: true,
                                          created_at: "",
                                          updated_at: "",
                                        })
                                      }
                                    >
                                      {hit.display_name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            <button
                              type="button"
                              className="mt-2 w-full rounded-md border px-2 py-1 text-xs text-red-600 hover:bg-red-500/10"
                              onClick={() => removeExerciseFromDraft(first.exercise_id)}
                            >
                              Remove Exercise
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {block.rows.map((row) => (
                        <div
                          key={row.draft_id}
                            className={[
                              "grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)_4.75rem] items-end gap-2 rounded-xl border p-2",
                              row.done
                                ? "border-muted bg-muted/10 opacity-60"
                                : "border-blue-500/40 bg-blue-500/10",
                            ].join(" ")}
                        >
                          <div className="order-1 pb-2 text-xs text-muted-foreground">Set {row.set_index}</div>

                          {row.set_type === "drop" ? (
                            <div className="order-2 col-span-3 grid gap-2">
                              {(row.segments || []).map((seg) => (
                                <div
                                  key={`${row.draft_id}:${seg.segment_index}`}
                                  className="grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2 rounded-xl border bg-background/30 p-2"
                                >
                                  <div className="pb-2 text-xs text-muted-foreground">{seg.label}</div>

                                  <label className="text-xs">
                                    <div className="text-muted-foreground">Weight</div>
                                    <input
                                      className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
                                      inputMode="decimal"
                                      value={seg.weight}
                                      disabled={row.done}
                                      readOnly={row.done}
                                      onFocus={selectNumberInputValue}
                                      onClick={selectNumberInputValue}
                                      onChange={(e) =>
                                        updateDraftSegment(row.draft_id, seg.segment_index, { weight: e.currentTarget.value })
                                      }
                                    />
                                  </label>

                                  <label className="text-xs">
                                    <div className="text-muted-foreground">Reps</div>
                                    <input
                                      className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
                                      inputMode="numeric"
                                      value={seg.reps}
                                      disabled={row.done}
                                      readOnly={row.done}
                                      onFocus={selectNumberInputValue}
                                      onClick={selectNumberInputValue}
                                      onChange={(e) =>
                                        updateDraftSegment(row.draft_id, seg.segment_index, { reps: e.currentTarget.value })
                                      }
                                    />
                                  </label>
                                </div>
                              ))}
                            </div>
                          ) : (
                              <>
                                <label className="order-2 text-xs">
                                  <div className="text-muted-foreground">Weight</div>
                                  <input
                                    className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
                                    inputMode="decimal"
                                    value={row.weight}
                                    disabled={row.done}
                                    readOnly={row.done}
                                    onFocus={selectNumberInputValue}
                                    onClick={selectNumberInputValue}
                                    onChange={(e) => {
                                      const value = e.currentTarget.value;
                                      updateDraftRow(row.draft_id, { weight: value });
                                    }}
                                  />
                                </label>

                                <label className="order-3 text-xs">
                                  <div className="text-muted-foreground">Reps</div>
                                  <input
                                    className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
                                    inputMode="numeric"
                                    value={row.reps}
                                    disabled={row.done}
                                    readOnly={row.done}
                                    onFocus={selectNumberInputValue}
                                    onClick={selectNumberInputValue}
                                    onChange={(e) => {
                                      const value = e.currentTarget.value;
                                      updateDraftRow(row.draft_id, { reps: value });
                                    }}
                                  />
                                </label>

                                <label className="order-5 col-span-4 text-xs">
                                  <div className="text-muted-foreground">Notes</div>
                                  <input
                                    className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
                                    value={row.flags}
                                    disabled={row.done}
                                    readOnly={row.done}
                                    onChange={(e) => {
                                      const value = e.currentTarget.value;
                                      updateDraftRow(row.draft_id, { flags: value });
                                    }}
                                    placeholder="optional note"
                                  />
                                </label>
                              </>
                            )}
                            <button
                              type="button"
                              className={[
                                "order-4 self-end rounded-xl border px-3 py-2 text-sm hover:bg-muted/30",
                                row.done ? "bg-muted/30" : "",
                              ].filter(Boolean).join(" ")}
                              onClick={() => updateDraftRow(row.draft_id, { done: !row.done })}
                              title={row.done ? "Mark pending" : "Mark done"}
                            >
                              {row.done ? "Done ✓" : "Enter"}
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
