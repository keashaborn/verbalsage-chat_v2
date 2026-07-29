"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { NumericInput } from "@/components/lifeswitch/NumericInput";

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
  exercise_role: "strength" | "rehab";
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

type ExerciseFamilyVariant = {
  exercise_family_member_id: string;
  exercise_id: string;
  slug: string;
  display_name: string;
  variant_label: string;
  modality: string;
  primary_muscles: string[];
  equipment_required: string[];
  unilateral: boolean;
  is_default: boolean;
  sort_order: number;
};

type ExerciseFamily = {
  exercise_family_id: string;
  slug: string;
  display_name: string;
  kind: string;
  movement_group: string;
  movement_pattern: string;
  primary_muscles: string[];
  description: string;
  sort_order: number;
  variants: ExerciseFamilyVariant[];
};

type ExercisePickerTab = "browse" | "search" | "mine";

type WorkoutTemplateRow = {
  workout_template_id: string;
  owner_user_id: string;
  name: string;
  notes?: string | null;
  workout_role?: "strength" | "rehab" | null;
  unclassified_session_count?: number;
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type WorkoutTemplateExerciseSegmentRow = {
  workout_template_exercise_segment_id: string;
  workout_template_exercise_id: string;
  segment_index: number;
  label?: string | null;
  default_weight: number;
  default_reps: number;
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
    const detail =
      j?.detail || j?.error || t?.slice(0, 300) || `HTTP ${r.status}`;
    throw new Error(String(detail));
  }
  return j;
}

function norm(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

function descriptiveExerciseKind(value?: string | null) {
  const clean = String(value || "").trim();
  const roleLikeKinds = new Set([
    "strength",
    "strength_training",
    "rehab",
    "prehab",
    "rehab_prehab",
  ]);
  return roleLikeKinds.has(norm(clean)) ? "" : clean;
}

function displayMovementGroup(value: string) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export default function TrainingWorkoutsPage() {
  const [myExercises, setMyExercises] = React.useState<MyExerciseRow[]>([]);
  const [templates, setTemplates] = React.useState<WorkoutTemplateRow[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");

  const [templateExercises, setTemplateExercises] = React.useState<
    WorkoutTemplateExerciseRow[]
  >([]);
  const [myLoading, setMyLoading] = React.useState(false);
  const [tplLoading, setTplLoading] = React.useState(false);
  const [exLoading, setExLoading] = React.useState(false);

  const [newName, setNewName] = React.useState<string>("");
  const [newRole, setNewRole] = React.useState<"strength" | "rehab">(
    "strength",
  );
  const [newWorkoutOpen, setNewWorkoutOpen] = React.useState(false);
  const [q, setQ] = React.useState<string>("");
  const [catalogHits, setCatalogHits] = React.useState<ExerciseSearchHit[]>([]);
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [catalogStatus, setCatalogStatus] = React.useState("");
  const [exerciseLibraryOpen, setExerciseLibraryOpen] = React.useState(false);
  const [exercisePickerTab, setExercisePickerTab] =
    React.useState<ExercisePickerTab>("browse");
  const [browseFamilies, setBrowseFamilies] = React.useState<ExerciseFamily[]>(
    [],
  );
  const [browseLoading, setBrowseLoading] = React.useState(false);
  const [browseStatus, setBrowseStatus] = React.useState("");
  const [browseQuery, setBrowseQuery] = React.useState("");
  const [browseGroup, setBrowseGroup] = React.useState("");
  const [openFamilyId, setOpenFamilyId] = React.useState("");
  const [myExerciseQuery, setMyExerciseQuery] = React.useState("");
  const [newExerciseOpen, setNewExerciseOpen] = React.useState(false);
  const [newExerciseName, setNewExerciseName] = React.useState("");
  const [newExerciseRole, setNewExerciseRole] = React.useState<
    "strength" | "rehab"
  >("strength");
  const [addStatus, setAddStatus] = React.useState("");
  const [editingSelected, setEditingSelected] = React.useState(false);
  const [openExerciseIds, setOpenExerciseIds] = React.useState<
    Record<string, boolean>
  >({});
  const [templateExerciseSegments, setTemplateExerciseSegments] =
    React.useState<Record<string, WorkoutTemplateExerciseSegmentRow[]>>({});
  const [segmentLoadingIds, setSegmentLoadingIds] = React.useState<
    Record<string, boolean>
  >({});
  const [shareUrl, setShareUrl] = React.useState("");
  const [shareStatus, setShareStatus] = React.useState("");
  const [openTemplateActionsId, setOpenTemplateActionsId] = React.useState("");
  const [openSelectedExerciseActionsId, setOpenSelectedExerciseActionsId] =
    React.useState("");
  const [workoutRoleStatus, setWorkoutRoleStatus] = React.useState("");

  const loadMyExercises = React.useCallback(async () => {
    setMyLoading(true);
    try {
      const j = (await fetchJson(
        "/api/lifeswitch/training/my_exercises",
      )) as any;
      const arr = Array.isArray(j) ? (j as MyExerciseRow[]) : [];
      setMyExercises(arr.filter((x) => x.is_active));
    } catch {
      setMyExercises([]);
    } finally {
      setMyLoading(false);
    }
  }, []);

  const loadTemplates = React.useCallback(async () => {
    setTplLoading(true);
    try {
      const j = (await fetchJson(
        "/api/lifeswitch/training/workout_templates",
      )) as any;
      const arr = Array.isArray(j) ? (j as WorkoutTemplateRow[]) : [];
      const active = arr.filter((x) => x.is_active);
      active.sort((a, b) =>
        String(b.updated_at || "").localeCompare(String(a.updated_at || "")),
      );
      setTemplates(active);
    } catch {
      setTemplates([]);
    } finally {
      setTplLoading(false);
    }
  }, []);

  const loadTemplateExercises = React.useCallback(
    async (workout_template_id: string) => {
      if (!workout_template_id) {
        setTemplateExercises([]);
        return;
      }
      setExLoading(true);
      try {
        const j = (await fetchJson(
          `/api/lifeswitch/training/workout_templates/${encodeURIComponent(workout_template_id)}/exercises`,
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
    [],
  );
  React.useEffect(() => {
    void loadMyExercises();
    void loadTemplates();
  }, [loadMyExercises, loadTemplates]);
  React.useEffect(() => {
    if (!selectedId) {
      setTemplateExercises([]);
      return;
    }
    void loadTemplateExercises(selectedId);
  }, [selectedId, loadTemplateExercises]);

  const selected = React.useMemo(() => {
    return templates.find((t) => t.workout_template_id === selectedId) || null;
  }, [templates, selectedId]);

  const clearSelectedWorkout = React.useCallback(() => {
    setSelectedId("");
    setEditingSelected(false);
    setOpenExerciseIds({});
    setTemplateExerciseSegments({});
    setTemplateExercises([]);
    setShareUrl("");
    setShareStatus("");
    setQ("");
    setCatalogHits([]);
    setCatalogStatus("");
    setExerciseLibraryOpen(false);
    setExercisePickerTab("browse");
    setBrowseQuery("");
    setBrowseGroup("");
    setOpenFamilyId("");
    setMyExerciseQuery("");
    setAddStatus("");
    setOpenSelectedExerciseActionsId("");
  }, []);

  React.useEffect(() => {
    setEditingSelected(false);
    setOpenExerciseIds({});
    setTemplateExerciseSegments({});
    setSegmentLoadingIds({});
    setShareUrl("");
    setShareStatus("");
  }, [selectedId]);

  const myExercisesById = React.useMemo(() => {
    const m = new Map<string, MyExerciseRow>();
    for (const x of myExercises) m.set(x.exercise_id, x);
    return m;
  }, [myExercises]);

  const personalHits = React.useMemo(() => {
    const qq = norm(myExerciseQuery);
    return myExercises
      .filter((x) => !qq || norm(x.display_name).includes(qq))
      .slice(0, 50);
  }, [myExerciseQuery, myExercises]);

  const savedExerciseIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const x of myExercises) {
      if (x.is_active) ids.add(String(x.exercise_id));
    }
    return ids;
  }, [myExercises]);

  const loadBrowseFamilies = React.useCallback(async () => {
    setBrowseLoading(true);
    setBrowseStatus("");

    try {
      const u = new URL(
        "/api/catalog/exercises/browse",
        window.location.origin,
      );
      u.searchParams.set("kind", "strength");
      u.searchParams.set("limit", "100");

      const j = (await fetchJson(u.toString())) as ExerciseFamily[];
      const arr = Array.isArray(j) ? j : [];
      setBrowseFamilies(arr);
      if (!arr.length) setBrowseStatus("No exercise families are available.");
    } catch {
      setBrowseFamilies([]);
      setBrowseStatus("The exercise library is unavailable right now.");
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (
      exerciseLibraryOpen &&
      exercisePickerTab === "browse" &&
      browseFamilies.length === 0 &&
      !browseStatus &&
      !browseLoading
    ) {
      void loadBrowseFamilies();
    }
  }, [
    browseFamilies.length,
    browseLoading,
    browseStatus,
    exerciseLibraryOpen,
    exercisePickerTab,
    loadBrowseFamilies,
  ]);

  const browseGroups = React.useMemo(() => {
    return Array.from(
      new Set(browseFamilies.map((family) => family.movement_group)),
    ).sort((a, b) =>
      displayMovementGroup(a).localeCompare(displayMovementGroup(b)),
    );
  }, [browseFamilies]);

  const filteredBrowseFamilies = React.useMemo(() => {
    const qq = norm(browseQuery);
    return browseFamilies.filter((family) => {
      if (browseGroup && family.movement_group !== browseGroup) return false;
      if (!qq) return true;
      return (
        norm(family.display_name).includes(qq) ||
        norm(family.description).includes(qq) ||
        family.primary_muscles.some((muscle) => norm(muscle).includes(qq)) ||
        family.variants.some(
          (variant) =>
            norm(variant.display_name).includes(qq) ||
            norm(variant.modality).includes(qq) ||
            variant.equipment_required.some((item) => norm(item).includes(qq)),
        )
      );
    });
  }, [browseFamilies, browseGroup, browseQuery]);

  React.useEffect(() => {
    const qq = q.trim();

    if (!exerciseLibraryOpen || exercisePickerTab !== "search") return;

    const h = setTimeout(async () => {
      if (!qq) {
        setCatalogHits([]);
        setCatalogStatus("");
        setAddStatus("");
        return;
      }

      setCatalogLoading(true);
      setCatalogStatus("");

      try {
        const u = new URL(
          "/api/catalog/exercises/search",
          window.location.origin,
        );
        u.searchParams.set("q", qq);
        u.searchParams.set("limit", "20");

        const j = (await fetchJson(u.toString())) as ExerciseSearchHit[];
        const arr = Array.isArray(j) ? j : [];

        setCatalogHits(arr);
        setCatalogStatus(arr.length ? "" : `No catalog matches for “${qq}”.`);
      } catch {
        setCatalogHits([]);
        setCatalogStatus("Exercise search is unavailable right now.");
      } finally {
        setCatalogLoading(false);
      }
    }, 250);

    return () => clearTimeout(h);
  }, [exerciseLibraryOpen, exercisePickerTab, q]);

  async function createTemplate() {
    const name = newName.trim();
    if (!name) return;
    const created = (await fetchJson(
      `/api/lifeswitch/training/workout_templates/upsert`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": globalThis.crypto.randomUUID(),
        },
        body: JSON.stringify({ name, notes: "", workout_role: newRole }),
      },
    )) as WorkoutTemplateRow;

    setNewName("");
    setNewWorkoutOpen(false);

    const createdId = String(created?.workout_template_id || "").trim();
    if (createdId) {
      setSelectedId(createdId);
      setTemplateExercises([]);
      setQ("");
    }

    await loadTemplates();

    if (createdId) {
      await loadTemplateExercises(createdId);
    }
  }

  async function updateSelected(patch: {
    name?: string;
    notes?: string | null;
    workout_role?: "strength" | "rehab";
  }) {
    if (!selected) return;
    if (!selected.workout_role && !patch.workout_role) {
      setWorkoutRoleStatus(
        "Choose Strength or Rehab before editing this workout.",
      );
      return;
    }
    await fetchJson(`/api/lifeswitch/training/workout_templates/upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": globalThis.crypto.randomUUID(),
      },
      body: JSON.stringify({
        workout_template_id: selected.workout_template_id,
        name: patch.name ?? selected.name,
        notes: patch.notes ?? selected.notes ?? "",
        workout_role: patch.workout_role ?? selected.workout_role,
      }),
    });
    await loadTemplates();
  }

  async function setWorkoutRole(
    template: WorkoutTemplateRow,
    workout_role: "strength" | "rehab",
  ) {
    setWorkoutRoleStatus(`Saving ${template.name}…`);
    try {
      await fetchJson(`/api/lifeswitch/training/workout_templates/upsert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": globalThis.crypto.randomUUID(),
        },
        body: JSON.stringify({
          workout_template_id: template.workout_template_id,
          name: template.name,
          notes: template.notes ?? "",
          workout_role,
        }),
      });
      await loadTemplates();
      setWorkoutRoleStatus(
        `${template.name} will count as ${workout_role === "rehab" ? "rehab" : "strength"} in future sessions.`,
      );
    } catch (e: any) {
      setWorkoutRoleStatus(String(e?.message || e));
    }
  }

  async function classifyHistoricalSessions(template: WorkoutTemplateRow) {
    const count = Math.max(0, Number(template.unclassified_session_count || 0));
    if (!template.workout_role || count === 0) return;

    const label = template.workout_role === "rehab" ? "rehab" : "strength";
    const ok = window.confirm(
      `Classify ${count} older unclassified session${count === 1 ? "" : "s"} for “${template.name}” as ${label}? This adds an audited classification and does not alter or delete the logged sets.`,
    );
    if (!ok) return;

    setWorkoutRoleStatus(`Classifying older ${template.name} sessions…`);
    try {
      const result = await fetchJson(
        `/api/lifeswitch/training/workout_templates/${encodeURIComponent(
          template.workout_template_id,
        )}/classify_historical_sessions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": globalThis.crypto.randomUUID(),
          },
          body: JSON.stringify({ workout_role: template.workout_role }),
        },
      );
      await loadTemplates();
      setWorkoutRoleStatus(
        `Classified ${Number(result?.classified_session_count || 0)} older session${
          Number(result?.classified_session_count || 0) === 1 ? "" : "s"
        } as ${label}.`,
      );
    } catch (e: any) {
      setWorkoutRoleStatus(String(e?.message || e));
    }
  }

  async function createShareLink() {
    if (!selected) return;

    setShareStatus("Creating share link…");
    setShareUrl("");

    try {
      const qs = new URLSearchParams({
        workout_template_id: selected.workout_template_id,
      });

      const j = await fetchJson(
        `/api/lifeswitch/training/workout_template_shares/create?${qs.toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: selected.name,
            notes: "",
          }),
        },
      );

      const token = String(j?.token || "").trim();
      if (!token) throw new Error("share token missing");

      const url = `${window.location.origin}/share/workout/${encodeURIComponent(token)}`;
      setShareUrl(url);
      setShareStatus("Share link created.");

      try {
        await navigator.clipboard.writeText(url);
        setShareStatus("Share link created and copied.");
      } catch {
        // Clipboard can fail in some browsers/contexts. Showing the URL is enough.
      }
    } catch (e: any) {
      setShareStatus(`Share failed: ${String(e?.message || e)}`);
    }
  }

  async function deactivateTemplate(workout_template_id: string) {
    const template = templates.find(
      (t) => t.workout_template_id === workout_template_id,
    );
    const name = template?.name || "this workout";
    const ok = window.confirm(
      `Delete workout "${name}"? This removes the template from your library.`,
    );
    if (!ok) return;

    await fetchJson(
      `/api/lifeswitch/training/workout_templates/${encodeURIComponent(workout_template_id)}/deactivate`,
      { method: "POST" },
    );
    if (selectedId === workout_template_id) setSelectedId("");
    setOpenTemplateActionsId("");
    await loadTemplates();
  }

  function customExerciseId(name: string) {
    const slug = norm(name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    const randomPart = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);

    return `custom:${slug || "exercise"}:${randomPart}`;
  }

  async function upsertMyExercise(input: {
    exercise_id: string;
    display_name: string;
    kind?: string | null;
    modality?: string | null;
    brand_name?: string | null;
    model_name?: string | null;
    matched_source?: string | null;
    exercise_role?: "strength" | "rehab";
  }) {
    const qs = new URLSearchParams();
    qs.set("exercise_id", String(input.exercise_id || "").trim());
    qs.set("display_name", String(input.display_name || "").trim());
    qs.set("kind", String(input.kind || "strength").trim());
    qs.set("modality", String(input.modality || "custom").trim());

    if (input.brand_name) qs.set("brand_name", String(input.brand_name));
    if (input.model_name) qs.set("model_name", String(input.model_name));
    if (input.matched_source)
      qs.set("matched_source", String(input.matched_source));
    if (input.exercise_role)
      qs.set("exercise_role", input.exercise_role);

    const row = (await fetchJson(
      `/api/lifeswitch/training/my_exercises/upsert?${qs.toString()}`,
      {
        method: "POST",
      },
    )) as MyExerciseRow;

    await loadMyExercises();
    return row;
  }

  async function addCatalogExerciseToSelected(hit: ExerciseSearchHit) {
    if (!selected) return;

    setAddStatus("");

    try {
      if (!savedExerciseIds.has(String(hit.exercise_id))) {
        await upsertMyExercise({
          exercise_id: hit.exercise_id,
          display_name: hit.display_name,
          kind: hit.kind,
          modality: hit.modality,
          brand_name: hit.brand_name,
          model_name: hit.model_name,
          matched_source: hit.matched_source || "catalog",
        });
      }

      await addExerciseToSelected(hit.exercise_id, hit.display_name);
      setAddStatus(
        `Added ${hit.display_name} to ${selected.name} and saved it to My exercises.`,
      );
    } catch (e: any) {
      setAddStatus(
        `Could not add ${hit.display_name}: ${String(e?.message || e)}`,
      );
    }
  }

  async function createCustomAndAddToSelected() {
    if (!selected) return;

    const name = newExerciseName.trim();
    if (!name) return;

    setAddStatus("");

    try {
      const row = await upsertMyExercise({
        exercise_id: customExerciseId(name),
        display_name: name,
        kind: "strength",
        modality: "custom",
        matched_source: "custom",
        exercise_role: newExerciseRole,
      });

      await addExerciseToSelected(row.exercise_id, row.display_name);
      setNewExerciseName("");
      setNewExerciseRole("strength");
      setNewExerciseOpen(false);
      setAddStatus(
        `Created ${row.display_name} and added it to ${selected.name}.`,
      );
    } catch (e: any) {
      setAddStatus(
        `Could not create that exercise: ${String(e?.message || e)}`,
      );
    }
  }
  async function addExerciseToSelected(
    exercise_id: string,
    display_name_snapshot?: string,
  ) {
    if (!selected) return;
    if (templateExercises.some((e) => e.exercise_id === exercise_id)) return;
    const maxSort = templateExercises.length
      ? Math.max(...templateExercises.map((x) => x.sort_order || 0))
      : 0;

    await fetchJson(
      `/api/lifeswitch/training/workout_templates/${encodeURIComponent(selected.workout_template_id)}/exercises/upsert`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_id,
          display_name_snapshot:
            String(display_name_snapshot || "").trim() || undefined,
          set_type: "straight",
          planned_sets: 3,
          default_weight: 0,
          default_reps: 10,
          flags: "",
          sort_order: maxSort + 10,
        }),
      },
    );

    setQ("");
    await loadTemplateExercises(selected.workout_template_id);
  }

  async function removeExerciseFromSelected(
    workout_template_exercise_id: string,
  ) {
    if (!selected) return;

    const exercise = templateExercises.find(
      (x) => x.workout_template_exercise_id === workout_template_exercise_id,
    );
    const name = exercise?.display_name_snapshot || "this exercise";
    const ok = window.confirm(`Remove exercise "${name}" from this workout?`);
    if (!ok) return;

    await fetchJson(
      `/api/lifeswitch/training/workout_templates/${encodeURIComponent(
        selected.workout_template_id,
      )}/exercises/${encodeURIComponent(workout_template_exercise_id)}/delete`,
      { method: "POST" },
    );

    setOpenSelectedExerciseActionsId("");
    await loadTemplateExercises(selected.workout_template_id);
  }

  async function reorderExercises(next: WorkoutTemplateExerciseRow[]) {
    if (!selected) return;

    for (let i = 0; i < next.length; i++) {
      const row = next[i];
      await fetchJson(
        `/api/lifeswitch/training/workout_templates/${encodeURIComponent(selected.workout_template_id)}/exercises/upsert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workout_template_exercise_id: row.workout_template_exercise_id,
            exercise_id: row.exercise_id,
            set_type: row.set_type || "straight",
            planned_sets: row.planned_sets,
            default_weight: row.default_weight,
            default_reps: row.default_reps,
            flags: row.flags ?? "",
            sort_order: (i + 1) * 10,
          }),
        },
      );
    }

    await loadTemplateExercises(selected.workout_template_id);
  }

  async function moveExercise(
    workout_template_exercise_id: string,
    dir: -1 | 1,
  ) {
    if (!selected) return;
    const idx = templateExercises.findIndex(
      (e) => e.workout_template_exercise_id === workout_template_exercise_id,
    );
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= templateExercises.length) return;
    const copy = templateExercises.slice();
    const tmp = copy[idx];
    copy[idx] = copy[j];
    copy[j] = tmp;
    await reorderExercises(copy);
  }

  async function loadTemplateExerciseSegments(
    workout_template_exercise_id: string,
  ) {
    setSegmentLoadingIds((prev) => ({
      ...prev,
      [workout_template_exercise_id]: true,
    }));

    try {
      const rows = (await fetchJson(
        `/api/lifeswitch/training/workout_template_exercises/${encodeURIComponent(workout_template_exercise_id)}/segments`,
      )) as WorkoutTemplateExerciseSegmentRow[];

      const arr = Array.isArray(rows) ? rows.slice() : [];
      arr.sort((a, b) => (a.segment_index ?? 0) - (b.segment_index ?? 0));

      setTemplateExerciseSegments((prev) => ({
        ...prev,
        [workout_template_exercise_id]: arr,
      }));
    } catch {
      setTemplateExerciseSegments((prev) => ({
        ...prev,
        [workout_template_exercise_id]: [],
      }));
    } finally {
      setSegmentLoadingIds((prev) => ({
        ...prev,
        [workout_template_exercise_id]: false,
      }));
    }
  }

  async function toggleExerciseOpen(row: WorkoutTemplateExerciseRow) {
    const id = row.workout_template_exercise_id;
    const nextOpen = !openExerciseIds[id];

    setOpenExerciseIds((prev) => ({
      ...prev,
      [id]: nextOpen,
    }));

    if (nextOpen && (row.set_type || "straight") === "drop") {
      await loadTemplateExerciseSegments(id);
    }
  }

  async function resizeDropSegments(
    row: WorkoutTemplateExerciseRow,
    drops: number,
  ) {
    const id = row.workout_template_exercise_id;
    const safeDrops = Math.max(1, Math.min(9, Math.floor(Number(drops) || 1)));
    const targetCount = safeDrops + 1;

    let current = templateExerciseSegments[id] || [];
    if (!current.length) {
      await loadTemplateExerciseSegments(id);
      current = templateExerciseSegments[id] || [];
    }

    const byIndex = new Map<number, WorkoutTemplateExerciseSegmentRow>();
    for (const seg of current) byIndex.set(Number(seg.segment_index || 0), seg);

    for (let idx = 1; idx <= targetCount; idx++) {
      const existing = byIndex.get(idx);
      const prev = byIndex.get(idx - 1);

      const defaultWeight =
        existing?.default_weight ??
        (idx === 1
          ? Number(row.default_weight || 0)
          : Math.max(
              0,
              Number(prev?.default_weight ?? row.default_weight ?? 0) - 10,
            ));

      const defaultReps =
        existing?.default_reps ??
        (idx === 1 ? Number(row.default_reps || 0) : 0);
      const label = idx === 1 ? "Start" : `Drop ${idx - 1}`;

      await fetchJson(
        `/api/lifeswitch/training/workout_template_exercises/${encodeURIComponent(id)}/segments/upsert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segment_index: idx,
            label,
            default_weight: defaultWeight,
            default_reps: defaultReps,
          }),
        },
      );
    }

    for (const seg of current) {
      if (Number(seg.segment_index || 0) > targetCount) {
        await fetchJson(
          `/api/lifeswitch/training/workout_template_exercises/${encodeURIComponent(id)}/segments/${encodeURIComponent(
            seg.workout_template_exercise_segment_id,
          )}/delete`,
          { method: "POST" },
        );
      }
    }

    await loadTemplateExerciseSegments(id);
  }

  async function updateExercise(
    workout_template_exercise_id: string,
    patch: Partial<WorkoutTemplateExerciseRow>,
  ) {
    if (!selected) return;
    const row = templateExercises.find(
      (x) => x.workout_template_exercise_id === workout_template_exercise_id,
    );
    if (!row) return;

    await fetchJson(
      `/api/lifeswitch/training/workout_templates/${encodeURIComponent(selected.workout_template_id)}/exercises/upsert`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workout_template_exercise_id,
          exercise_id: row.exercise_id,
          display_name_snapshot:
            patch.display_name_snapshot ??
            row.display_name_snapshot ??
            undefined,
          set_type: patch.set_type ?? row.set_type ?? "straight",
          planned_sets: patch.planned_sets ?? row.planned_sets,
          default_weight: patch.default_weight ?? row.default_weight,
          default_reps: patch.default_reps ?? row.default_reps,
          flags: (patch.flags ?? row.flags ?? "") as any,
          sort_order: patch.sort_order ?? row.sort_order,
        }),
      },
    );

    await loadTemplateExercises(selected.workout_template_id);

    if ((patch.set_type ?? row.set_type ?? "straight") === "drop") {
      await loadTemplateExerciseSegments(workout_template_exercise_id);
    }
  }

  function renderSelectedWorkoutDetail() {
    if (!selected) return null;

    return (
      <main className="grid min-w-0 gap-6">
            <section className="min-w-0 border-b border-border/50 pb-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Selected workout</div>
                  <div className="mt-1 truncate text-lg font-medium">
                    {selected.name}
                  </div>
                  {selected.notes ? (
                    <div className="mt-1 text-sm text-muted-foreground">
                      {selected.notes}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                    onClick={() => void createShareLink()}
                    disabled={!selected}
                  >
                    Share
                  </button>

                  <button
                    type="button"
                    className="rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    onClick={() => setEditingSelected((v) => !v)}
                  >
                    {editingSelected ? "Done" : "Edit"}
                  </button>

                  <button
                    type="button"
                    className="rounded-lg bg-muted px-2.5 py-1.5 text-sm font-medium hover:bg-muted/80"
                    onClick={clearSelectedWorkout}
                  >
                    Close
                  </button>
                </div>
              </div>

              {shareStatus || shareUrl ? (
                <div className="mt-4 rounded-xl border bg-muted/20 p-3 text-sm">
                  {shareStatus ? <div>{shareStatus}</div> : null}
                  {shareUrl ? (
                    <div className="mt-2 text-xs break-all text-muted-foreground">
                      {shareUrl}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {editingSelected ? (
                <div className="mt-4 grid gap-3">
                  {!selected.workout_role ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-200">
                      Choose Strength or Rehab before editing this workout.
                    </div>
                  ) : null}
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Workout type
                    </div>
                    <div className="mt-1 flex items-center gap-4">
                      {(["strength", "rehab"] as const).map((role) => (
                        <button
                          key={role}
                          type="button"
                          className={`border-b-2 py-1 text-sm font-medium ${selected.workout_role === role ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                          onClick={() => void setWorkoutRole(selected, role)}
                        >
                          {role === "strength" ? "Strength" : "Rehab / prehab"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label>
                    <div className="text-xs text-muted-foreground">Name</div>
                    <input
                      className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                      value={selected.name}
                      onChange={(e) =>
                        void updateSelected({ name: e.target.value })
                      }
                      disabled={!selected.workout_role}
                      placeholder="Workout name"
                    />
                  </label>

                  <label>
                    <div className="text-xs text-muted-foreground">Notes</div>
                    <input
                      className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                      value={selected.notes || ""}
                      onChange={(e) =>
                        void updateSelected({ notes: e.target.value })
                      }
                      disabled={!selected.workout_role}
                      placeholder="(optional)"
                    />
                  </label>
                </div>
              ) : null}
            </section>

            <section className="min-w-0 border-b border-border/50 pb-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">
                    Exercises in this workout
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Template defaults. Capture can change these for a single
                    session.
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {exLoading
                    ? "Loading…"
                    : `${templateExercises.length} exercise${templateExercises.length === 1 ? "" : "s"}`}
                </div>
              </div>

              {templateExercises.length ? (
                <div className="mt-3 divide-y divide-border/50 border-y border-border/50">
                  {templateExercises.map((e) => {
                    const meta = myExercisesById.get(e.exercise_id);
                    const title =
                      e.display_name_snapshot ||
                      meta?.display_name ||
                      e.exercise_id;
                    const open =
                      openExerciseIds[e.workout_template_exercise_id] || false;
                    const segments =
                      templateExerciseSegments[
                        e.workout_template_exercise_id
                      ] || [];
                    const segmentsLoading =
                      segmentLoadingIds[e.workout_template_exercise_id] ||
                      false;

                    return (
                      <div
                        key={e.workout_template_exercise_id}
                        className="min-w-0 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => void toggleExerciseOpen(e)}
                          >
                            <div className="flex items-center gap-2">
                              {open ? (
                                <ChevronUp className="h-4 w-4 shrink-0" />
                              ) : (
                                <ChevronDown className="h-4 w-4 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-foreground">
                                  {title}
                                </div>
                                {meta?.exercise_role === "rehab" ? (
                                  <span className="mt-1 inline-flex text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                                    Rehab · not a strength session
                                  </span>
                                ) : null}
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {(e.set_type || "straight") === "drop"
                                    ? "drop"
                                    : "straight"}{" "}
                                  · {e.planned_sets} sets · {e.default_weight} ×{" "}
                                  {e.default_reps}
                                  {meta?.modality ? ` · ${meta.modality}` : ""}
                                  {descriptiveExerciseKind(meta?.kind)
                                    ? ` · ${descriptiveExerciseKind(meta?.kind)}`
                                    : ""}
                                </div>
                              </div>
                            </div>
                          </button>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              className="rounded-md p-2 hover:bg-muted/20 active:bg-muted/30"
                              onClick={() =>
                                void moveExercise(
                                  e.workout_template_exercise_id,
                                  -1,
                                )
                              }
                              title="Move up"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded-md p-2 hover:bg-muted/20 active:bg-muted/30"
                              onClick={() =>
                                void moveExercise(
                                  e.workout_template_exercise_id,
                                  1,
                                )
                              }
                              title="Move down"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            <div className="relative">
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground active:bg-muted/70"
                                onClick={() =>
                                  setOpenSelectedExerciseActionsId((prev) =>
                                    prev === e.workout_template_exercise_id
                                      ? ""
                                      : e.workout_template_exercise_id,
                                  )
                                }
                                aria-expanded={
                                  openSelectedExerciseActionsId ===
                                  e.workout_template_exercise_id
                                }
                                aria-label={`Actions for ${title}`}
                                title="Exercise actions"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>

                              {openSelectedExerciseActionsId ===
                              e.workout_template_exercise_id ? (
                                <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-red-500/20 bg-background p-2 shadow-lg">
                                  <div className="text-[11px] font-semibold tracking-wide text-red-500 uppercase">
                                    Danger zone
                                  </div>
                                  <button
                                    type="button"
                                    className="mt-2 inline-flex w-full items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-600 hover:bg-red-500/10"
                                    onClick={() =>
                                      void removeExerciseFromSelected(
                                        e.workout_template_exercise_id,
                                      )
                                    }
                                    title="Remove exercise"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Remove exercise
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {open ? (
                          <div className="mt-3 grid gap-3 overflow-hidden">
                            <div className="flex flex-wrap items-end gap-4 text-sm">
                              <label className="flex items-baseline gap-2">
                                <span className="text-[11px] text-muted-foreground">
                                  format
                                </span>
                                <select
                                  className="border-b border-muted/30 bg-transparent px-1 py-1 text-sm focus:border-ring focus:outline-none"
                                  value={e.set_type || "straight"}
                                  onChange={(ev) =>
                                    void updateExercise(
                                      e.workout_template_exercise_id,
                                      { set_type: ev.target.value },
                                    )
                                  }
                                >
                                  <option value="straight">Straight</option>
                                  <option value="drop">Drop</option>
                                </select>
                              </label>

                              {(e.set_type || "straight") === "drop" ? (
                                <label className="flex items-baseline gap-2">
                                  <span className="text-[11px] text-muted-foreground">
                                    drops
                                  </span>
                                  <select
                                    className="border-b border-muted/30 bg-transparent px-1 py-1 text-sm focus:border-ring focus:outline-none"
                                    value={String(
                                      Math.max(1, (segments.length || 2) - 1),
                                    )}
                                    onChange={(ev) =>
                                      void resizeDropSegments(
                                        e,
                                        Number(ev.target.value),
                                      )
                                    }
                                  >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                      <option key={n} value={n}>
                                        {n}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-end gap-4 text-sm">
                              <label className="flex items-baseline gap-2">
                                <span className="text-[11px] text-muted-foreground">
                                  sets
                                </span>
                                <NumericInput
                                  className="w-12 border-b border-muted/30 bg-transparent px-1 py-1 text-sm focus:border-ring focus:outline-none"
                                  mode="integer"
                                  min={1}
                                  required
                                  value={String(e.planned_sets)}
                                  onValueChange={(value) =>
                                    void updateExercise(
                                      e.workout_template_exercise_id,
                                      { planned_sets: Number(value || 0) },
                                    )
                                  }
                                />
                              </label>

                              <label className="flex items-baseline gap-2">
                                <span className="text-[11px] text-muted-foreground">
                                  wt
                                </span>
                                <NumericInput
                                  className="w-16 border-b border-muted/30 bg-transparent px-1 py-1 text-sm focus:border-ring focus:outline-none"
                                  mode="decimal"
                                  min={0}
                                  required
                                  value={String(e.default_weight)}
                                  onValueChange={(value) =>
                                    void updateExercise(
                                      e.workout_template_exercise_id,
                                      { default_weight: Number(value || 0) },
                                    )
                                  }
                                />
                              </label>

                              <label className="flex items-baseline gap-2">
                                <span className="text-[11px] text-muted-foreground">
                                  reps
                                </span>
                                <NumericInput
                                  className="w-12 border-b border-muted/30 bg-transparent px-1 py-1 text-sm focus:border-ring focus:outline-none"
                                  mode="integer"
                                  min={0}
                                  required
                                  value={String(e.default_reps)}
                                  onValueChange={(value) =>
                                    void updateExercise(
                                      e.workout_template_exercise_id,
                                      { default_reps: Number(value || 0) },
                                    )
                                  }
                                />
                              </label>
                            </div>

                            <input
                              className="w-full border-b border-muted/30 bg-transparent px-1 py-2 text-sm focus:border-ring focus:outline-none"
                              value={e.flags || ""}
                              onChange={(ev) =>
                                void updateExercise(
                                  e.workout_template_exercise_id,
                                  { flags: ev.target.value },
                                )
                              }
                              placeholder="notes / flags (optional)"
                            />

                            {(e.set_type || "straight") === "drop" ? (
                              <div className="max-w-full overflow-hidden rounded-xl border p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <div className="text-xs font-semibold">
                                      Drop set structure
                                    </div>
                                    <div className="mt-1 text-[11px] text-muted-foreground">
                                      Start weight plus each drop after it.
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="rounded-md border px-2 py-1 text-xs hover:bg-muted/30"
                                    onClick={() =>
                                      void loadTemplateExerciseSegments(
                                        e.workout_template_exercise_id,
                                      )
                                    }
                                  >
                                    Refresh
                                  </button>
                                </div>

                                {segmentsLoading ? (
                                  <div className="mt-2 text-xs text-muted-foreground">
                                    Loading drops...
                                  </div>
                                ) : segments.length ? (
                                  <div className="mt-3 grid gap-2">
                                    {segments.map((seg) => (
                                      <div
                                        key={
                                          seg.workout_template_exercise_segment_id
                                        }
                                        className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-lg border px-2 py-2 text-xs"
                                      >
                                        <div className="text-muted-foreground">
                                          {seg.segment_index === 1
                                            ? "Start"
                                            : `Drop ${seg.segment_index - 1}`}
                                        </div>
                                        <div>wt {seg.default_weight}</div>
                                        <div>reps {seg.default_reps || ""}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-2 text-xs text-muted-foreground">
                                    Select a drop count to create the drop rows.
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 text-sm text-muted-foreground">
                  Empty. Search exercises on the right and add a few.
                </div>
              )}
            </section>
            <section className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    Add exercises to {selected.name}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Browse common movements or find a specific machine,
                    variation, or saved exercise.
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80"
                  onClick={() => setExerciseLibraryOpen((open) => !open)}
                  aria-expanded={exerciseLibraryOpen}
                >
                  {exerciseLibraryOpen
                    ? "Hide exercise library"
                    : "Show exercise library"}
                </button>
              </div>

              {exerciseLibraryOpen ? (
                <div className="mt-4">
                  <div
                    className="grid grid-cols-3 rounded-xl bg-muted/50 p-1"
                    role="tablist"
                    aria-label="Choose how to find an exercise"
                  >
                    {(
                      [
                        ["browse", "Browse"],
                        ["search", "Search equipment"],
                        ["mine", "My exercises"],
                      ] as const
                    ).map(([tab, label]) => (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={exercisePickerTab === tab}
                        className={`rounded-lg px-2 py-2 text-xs font-medium sm:text-sm ${
                          exercisePickerTab === tab
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:bg-muted/30"
                        }`}
                        onClick={() => setExercisePickerTab(tab)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {exercisePickerTab === "browse" ? (
                    <div className="mt-4">
                      <div className="text-sm font-semibold">
                        Movement library
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Start with the movement. Open it to choose the exact
                        free-weight, bodyweight, cable, or machine variation.
                      </div>

                      <input
                        className="mt-3 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        value={browseQuery}
                        onChange={(event) => setBrowseQuery(event.target.value)}
                        placeholder="Filter bench press, row, squat, core..."
                      />

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={`rounded-full border px-3 py-1 text-xs ${
                            !browseGroup
                              ? "border-foreground bg-foreground text-background"
                              : "hover:bg-muted/20"
                          }`}
                          onClick={() => setBrowseGroup("")}
                        >
                          All
                        </button>
                        {browseGroups.map((group) => (
                          <button
                            key={group}
                            type="button"
                            className={`rounded-full border px-3 py-1 text-xs ${
                              browseGroup === group
                                ? "border-foreground bg-foreground text-background"
                                : "hover:bg-muted/20"
                            }`}
                            onClick={() => setBrowseGroup(group)}
                          >
                            {displayMovementGroup(group)}
                          </button>
                        ))}
                      </div>

                      {browseLoading ? (
                        <div className="mt-4 text-sm text-muted-foreground">
                          Loading exercise library…
                        </div>
                      ) : null}

                      {browseStatus ? (
                        <div className="mt-4 rounded-xl border p-3 text-sm text-muted-foreground">
                          {browseStatus}
                          <button
                            type="button"
                            className="ml-2 underline underline-offset-2"
                            onClick={() => void loadBrowseFamilies()}
                          >
                            Try again
                          </button>
                        </div>
                      ) : null}

                      {!browseLoading && !browseStatus ? (
                        <div className="mt-3 divide-y divide-border/50 border-y border-border/50">
                          {filteredBrowseFamilies.map((family) => {
                            const open =
                              openFamilyId === family.exercise_family_id;
                            return (
                              <div
                                key={family.exercise_family_id}
                                className={open ? "bg-muted/10" : ""}
                              >
                                <button
                                  type="button"
                                  className="flex w-full items-start justify-between gap-3 py-3 text-left hover:bg-muted/10"
                                  onClick={() =>
                                    setOpenFamilyId(
                                      open ? "" : family.exercise_family_id,
                                    )
                                  }
                                  aria-expanded={open}
                                >
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-blue-400">
                                      {family.display_name}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      {displayMovementGroup(
                                        family.movement_group,
                                      )}{" "}
                                      · {family.variants.length} variation
                                      {family.variants.length === 1 ? "" : "s"}
                                    </div>
                                    {family.description ? (
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {family.description}
                                      </div>
                                    ) : null}
                                  </div>
                                  {open ? (
                                    <ChevronUp className="mt-0.5 h-4 w-4 shrink-0" />
                                  ) : (
                                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" />
                                  )}
                                </button>

                                {open ? (
                                  <div className="ml-4 divide-y divide-border/40 border-t border-border/40">
                                    {family.variants.map((variant) => {
                                      const alreadyIn = templateExercises.some(
                                        (exercise) =>
                                          exercise.exercise_id ===
                                          variant.exercise_id,
                                      );
                                      const alreadySaved = savedExerciseIds.has(
                                        String(variant.exercise_id),
                                      );
                                      return (
                                        <div
                                          key={variant.exercise_id}
                                          className="flex items-center justify-between gap-3 py-3"
                                        >
                                          <div className="min-w-0">
                                            <div className="text-sm font-medium">
                                              {variant.display_name}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                              {variant.modality || "exercise"}
                                              {variant.is_default
                                                ? " · common starting point"
                                                : ""}
                                              {alreadySaved
                                                ? " · in My exercises"
                                                : ""}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            className="shrink-0 rounded-xl border px-3 py-1.5 text-xs hover:bg-muted/30 disabled:opacity-50"
                                            disabled={alreadyIn}
                                            onClick={() =>
                                              void addCatalogExerciseToSelected(
                                                {
                                                  exercise_id:
                                                    variant.exercise_id,
                                                  display_name:
                                                    variant.display_name,
                                                  kind: family.kind,
                                                  modality: variant.modality,
                                                  matched_source:
                                                    "exercise_family",
                                                },
                                              )
                                            }
                                          >
                                            {alreadyIn ? "Added" : "Add"}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}

                      {!filteredBrowseFamilies.length ? (
                        <div className="py-3 text-sm text-muted-foreground">
                              No movement family matches those filters.
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {exercisePickerTab === "search" ? (
                    <div className="mt-4">
                      <div className="text-sm font-semibold">
                        Search equipment and variations
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Search by machine, brand, movement, or exact exercise
                        name.
                      </div>
                      <input
                        className="mt-3 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        value={q}
                        onChange={(event) => setQ(event.target.value)}
                        placeholder="Hammer Strength chest press, barbell bench..."
                        autoFocus
                      />

                      {q.trim() ? (
                        <div className="mt-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold text-muted-foreground">
                              Catalog results
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {catalogLoading
                                ? "Searching…"
                                : catalogHits.length
                                  ? `${catalogHits.length} found`
                                  : ""}
                            </div>
                          </div>

                          {catalogHits.length ? (
                            <div className="mt-2 divide-y divide-muted/20">
                              {catalogHits.map((hit) => {
                                const alreadyIn = templateExercises.some(
                                  (exercise) =>
                                    exercise.exercise_id === hit.exercise_id,
                                );
                                const alreadySaved = savedExerciseIds.has(
                                  String(hit.exercise_id),
                                );
                                return (
                                  <div
                                    key={hit.exercise_id}
                                    className="flex items-center justify-between gap-3 py-3"
                                  >
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium">
                                        {hit.display_name}
                                      </div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {hit.modality || "exercise"}
                                        {hit.brand_name
                                          ? ` · ${hit.brand_name}`
                                          : ""}
                                        {alreadySaved
                                          ? " · in My exercises"
                                          : ""}
                                      </div>
                                      {hit.matched_text ? (
                                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                          Matched: {hit.matched_text}
                                        </div>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      className="shrink-0 rounded-xl border px-3 py-1.5 text-xs hover:bg-muted/30 disabled:opacity-50"
                                      onClick={() =>
                                        void addCatalogExerciseToSelected(hit)
                                      }
                                      disabled={alreadyIn}
                                    >
                                      {alreadyIn ? "Added" : "Add"}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}

                          {!catalogLoading && catalogStatus ? (
                            <div className="mt-3 rounded-xl border p-3 text-sm text-muted-foreground">
                              {catalogStatus}
                            </div>
                          ) : null}

                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border p-3 text-sm text-muted-foreground">
                          Enter a machine, brand, or exercise name.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {exercisePickerTab === "mine" ? (
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">My exercises</div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-300"
                          onClick={() => {
                            setNewExerciseOpen((open) => !open);
                            setAddStatus("");
                          }}
                          aria-expanded={newExerciseOpen}
                        >
                          {newExerciseOpen ? null : <Plus className="h-4 w-4" />}
                          {newExerciseOpen ? "Cancel" : "Add exercise"}
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Exercises you have saved or created previously.
                      </div>

                      {newExerciseOpen ? (
                        <div className="mt-3 border-y border-border/50 py-3">
                          <input
                            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                            value={newExerciseName}
                            onChange={(event) =>
                              setNewExerciseName(event.target.value)
                            }
                            placeholder="Exercise name"
                            autoFocus
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                void createCustomAndAddToSelected();
                              }
                            }}
                          />
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              Type
                            </span>
                            <button
                              type="button"
                              className={`border-b-2 py-1 text-[11px] font-semibold tracking-wide ${
                                newExerciseRole === "rehab"
                                  ? "border-foreground text-muted-foreground"
                                  : "border-blue-600 text-blue-700 dark:text-blue-300"
                              }`}
                              onClick={() =>
                                setNewExerciseRole((role) =>
                                  role === "strength" ? "rehab" : "strength",
                                )
                              }
                              aria-label="Change exercise type"
                            >
                              {newExerciseRole.toUpperCase()}
                            </button>
                            <span className="text-xs text-muted-foreground">
                              Click the type to change it
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xs text-muted-foreground">
                              Sets, weight, reps, and set type are configured
                              after it is added.
                            </span>
                            <button
                              type="button"
                              className="rounded-lg border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-500/20 disabled:opacity-50 dark:text-blue-300"
                              onClick={() =>
                                void createCustomAndAddToSelected()
                              }
                              disabled={!newExerciseName.trim()}
                            >
                              Create and add
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <input
                        className="mt-3 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        value={myExerciseQuery}
                        onChange={(event) =>
                          setMyExerciseQuery(event.target.value)
                        }
                        placeholder="Filter My exercises"
                      />

                      {myLoading ? (
                        <div className="mt-3 text-sm text-muted-foreground">
                          Loading My exercises…
                        </div>
                      ) : personalHits.length ? (
                        <div className="mt-2 divide-y divide-muted/20">
                          {personalHits.map((exercise) => {
                            const alreadyIn = templateExercises.some(
                              (item) =>
                                item.exercise_id === exercise.exercise_id,
                            );
                            return (
                              <div
                                key={exercise.exercise_id}
                                className="flex items-center justify-between gap-3 py-3"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium">
                                    {exercise.display_name}
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {exercise.modality || "exercise"}
                                    {exercise.brand_name
                                      ? ` · ${exercise.brand_name}`
                                      : ""}
                                    {exercise.exercise_role === "rehab"
                                      ? " · rehab"
                                      : ""}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="shrink-0 rounded-xl border px-3 py-1.5 text-xs hover:bg-muted/30 disabled:opacity-50"
                                  onClick={() =>
                                    void addExerciseToSelected(
                                      exercise.exercise_id,
                                      exercise.display_name,
                                    )
                                  }
                                  disabled={alreadyIn}
                                >
                                  {alreadyIn ? "Added" : "Add"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border p-3 text-sm text-muted-foreground">
                          No saved exercise matches that filter.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {addStatus ? (
                    <div
                      className="mt-4 rounded-xl bg-muted/30 px-3 py-2 text-sm"
                      aria-live="polite"
                    >
                      {addStatus}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-xl bg-muted/20 p-3 text-sm text-muted-foreground">
                  Open the exercise library when you want to add or compare
                  movements. Your existing workout and logged sessions are not
                  changed by browsing.
                </div>
              )}
            </section>
      </main>
    );
  }

  return (
    <div className="w-full min-w-0 overflow-x-hidden">
      <div className="grid min-w-0 gap-6">
        <section aria-labelledby="workout-list-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="workout-list-heading" className="text-lg font-semibold">
                Your workouts
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a workout to review its exercises and defaults.
              </p>
            </div>
            {templates.length > 0 || newWorkoutOpen ? (
              <button
                type="button"
                className={[
                  "inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg border px-3 text-sm font-medium transition-colors",
                  newWorkoutOpen
                    ? "border-border/60 bg-muted/70 text-foreground hover:bg-muted"
                    : "border-blue-500/25 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300",
                ].join(" ")}
                onClick={() => setNewWorkoutOpen((open) => !open)}
                aria-expanded={newWorkoutOpen}
              >
                {newWorkoutOpen ? null : <Plus className="h-4 w-4" />}
                {newWorkoutOpen ? "Cancel" : "New workout"}
              </button>
            ) : null}
          </div>

          {newWorkoutOpen ? (
            <div className="mt-4 border-y border-border/50 py-4">
              <div className="mb-4">
                <div className="text-sm font-semibold">Create a workout</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Name the reusable template and choose its workout type.
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.45fr)_auto] sm:items-end">
              <input
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New workout name"
                aria-label="New workout name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createTemplate();
                }}
              />
              <label>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Workout type
                </div>
                <select
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(
                      e.target.value === "rehab" ? "rehab" : "strength",
                    )
                  }
                >
                  <option value="strength">Strength training</option>
                  <option value="rehab">Rehab / prehab</option>
                </select>
              </label>
              <button
                type="button"
                className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-40"
                onClick={() => void createTemplate()}
                disabled={!newName.trim()}
                title="Create workout"
              >
                Create
              </button>
            </div>
            </div>
          ) : null}

          {tplLoading ? (
            <div className="mt-4 text-sm text-muted-foreground">
              Loading workouts…
            </div>
          ) : null}

          {workoutRoleStatus ? (
            <div className="mt-4 rounded-xl bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {workoutRoleStatus}
            </div>
          ) : null}

          {templates.length ? (
            <div className="mt-4 divide-y divide-border/50 border-y border-border/50">
              {templates.map((t) => {
                const active = t.workout_template_id === selectedId;

                return (
                  <div
                    key={t.workout_template_id}
                    className={`px-1 py-3 ${active ? "bg-muted/30" : "hover:bg-muted/20"}`}
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="min-w-0 text-left"
                        onClick={() => setSelectedId(t.workout_template_id)}
                      >
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {t.name}
                        </span>
                      </button>
                      <span
                        className={`text-[10px] font-semibold tracking-wide uppercase ${
                          t.workout_role === "rehab"
                            ? "text-muted-foreground"
                            : t.workout_role === "strength"
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {t.workout_role === "rehab"
                          ? "Rehab"
                          : t.workout_role === "strength"
                            ? "Strength"
                            : "Unclassified"}
                      </span>
                      <button
                        type="button"
                        className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        onClick={() =>
                          setOpenTemplateActionsId((prev) =>
                            prev === t.workout_template_id
                              ? ""
                              : t.workout_template_id,
                          )
                        }
                        aria-expanded={
                          openTemplateActionsId === t.workout_template_id
                        }
                        aria-label={`Actions for ${t.name}`}
                        title={`Actions for ${t.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>

                    {t.workout_role &&
                    Number(t.unclassified_session_count || 0) > 0 ? (
                      <button
                        type="button"
                        className="mt-2 w-full rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-2 text-left text-xs text-amber-200 hover:bg-amber-500/10"
                        onClick={() => void classifyHistoricalSessions(t)}
                      >
                        Apply{" "}
                        {t.workout_role === "rehab" ? "rehab" : "strength"} to{" "}
                        {Number(t.unclassified_session_count)} older
                        unclassified session
                        {Number(t.unclassified_session_count) === 1 ? "" : "s"}
                      </button>
                    ) : null}

                    {openTemplateActionsId === t.workout_template_id ? (
                      <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                        <div className="text-[11px] font-semibold tracking-wide text-red-500 uppercase">
                          Danger zone
                        </div>
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-600 hover:bg-red-500/10"
                          onClick={() =>
                            void deactivateTemplate(t.workout_template_id)
                          }
                          title="Delete workout"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete workout
                        </button>
                      </div>
                    ) : null}

                  </div>
                );
              })}
            </div>
          ) : newWorkoutOpen ? null : (
            <div className="mt-4 rounded-2xl bg-muted/20 px-5 py-8 text-center">
              <div className="text-sm font-semibold">No workouts yet</div>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Create a reusable workout, then add exercises from the catalog
                or your library.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
                onClick={() => setNewWorkoutOpen(true)}
              >
                <Plus className="h-4 w-4" />
                New workout
              </button>
            </div>
          )}
        </section>

        {selected ? (
          <section className="border-t border-border/50 pt-6">
            {renderSelectedWorkoutDetail()}
          </section>
        ) : null}
      </div>
    </div>
  );
}
