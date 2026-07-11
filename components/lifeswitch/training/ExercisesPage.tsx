"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

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
    const detail = j?.detail ?? j?.error ?? t?.slice(0, 300) ?? `HTTP ${r.status}`;
    const detailStr =
      typeof detail === "string"
        ? detail
        : (() => {
          try {
            return JSON.stringify(detail);
          } catch {
            return String(detail);
          }
        })();
    throw new Error(detailStr || `HTTP ${r.status}`);
  }
  return j;
}

function norm(s: string) {
  return String(s || "").trim().toLowerCase();
}

export default function TrainingExercisesPage() {
  // My Training Library (personal exercise library)
  const [myExercises, setMyExercises] = React.useState<MyExerciseRow[]>([]);
  const [myLoading, setMyLoading] = React.useState(false);

  const loadMyExercises = React.useCallback(async () => {
    setMyLoading(true);
    try {
      const j = (await fetchJson("/api/lifeswitch/training/my_exercises")) as MyExerciseRow[];
      setMyExercises(Array.isArray(j) ? j : []);
    } catch {
      setMyExercises([]);
    } finally {
      setMyLoading(false);
    }
  }, []);


  React.useEffect(() => {
    void loadMyExercises();
  }, [loadMyExercises]);


  // Catalog search (global)
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<ExerciseSearchHit[]>([]);
  const [hitsLoading, setHitsLoading] = React.useState(false);
  const [hitsStatus, setHitsStatus] = React.useState<string>("");
  const [saveErr, setSaveErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    const qq = q.trim();
    const h = setTimeout(async () => {
      if (!qq) {
        setHits([]);
        setHitsStatus("");
        return;
      }
      setHitsLoading(true);
      setHitsStatus("");
      try {
        const u = new URL("/api/catalog/exercises/search", window.location.origin);
        u.searchParams.set("q", qq);
        u.searchParams.set("limit", "25");
        const j = (await fetchJson(u.toString())) as ExerciseSearchHit[];
        const arr = Array.isArray(j) ? j : [];
        setHits(arr);
        setHitsStatus(`hits=${arr.length}`);
      } catch (e: any) {
        setHits([]);
        setHitsStatus(`error: ${String(e?.message || e)}`);
      } finally {
        setHitsLoading(false);
      }
    }, 250);
    return () => clearTimeout(h);
  }, [q]);

  const savedIds = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of myExercises) {
      if (r.is_active) s.add(String(r.exercise_id));
    }
    return s;
  }, [myExercises]);

  const [openExerciseActionsId, setOpenExerciseActionsId] = React.useState("");

  async function saveExercise(h: ExerciseSearchHit) {
    setSaveErr(null);

    // Backend expects these in query (FastAPI 422 loc=["query",...])
    const qs = new URLSearchParams();
    qs.set("exercise_id", String(h.exercise_id || "").trim());
    qs.set("display_name", String(h.display_name || "").trim());

    // include these too to avoid the next round of 422 if they’re required
    if (h.kind) qs.set("kind", String(h.kind));
    if (h.modality) qs.set("modality", String(h.modality));
    if (h.brand_name) qs.set("brand_name", String(h.brand_name));
    if (h.model_name) qs.set("model_name", String(h.model_name));
    if (h.matched_source) qs.set("matched_source", String(h.matched_source));

    // DO NOT send matched_text in query (can be long and blow URL)
    // If we later want it, we’ll change backend to accept JSON body.

    try {
      await fetchJson(`/api/lifeswitch/training/my_exercises/upsert?${qs.toString()}`, {
        method: "POST",
      });
      await loadMyExercises();
    } catch (e: any) {
      setSaveErr(String(e?.message || e));
    }
  }

  async function removeExercise(row: MyExerciseRow) {
    const ok = window.confirm(`Remove exercise "${row.display_name}" from your exercise library?`);
    if (!ok) return;

    await fetchJson(
      `/api/lifeswitch/training/my_exercises/${encodeURIComponent(row.my_exercise_id)}/deactivate`,
      { method: "POST" }
    );
    setOpenExerciseActionsId("");
    await loadMyExercises();
  }



  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="text-xl font-semibold">My Training Library</h1>

      {/* Search */}
      <div className="mt-3 grid gap-2">
        <input
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search or review saved/custom exercises"
        />
        <div className="text-xs text-muted-foreground">
          {hitsLoading ? "searching…" : hitsStatus}

        </div>
        {saveErr ? (
          <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs">
            <div className="font-medium">Save failed</div>
            <div className="mt-1 opacity-80">{saveErr}</div>
          </div>
        ) : null}

        {hits.length ? (
          <div className="divide-y divide-muted/20">
            {hits.map((h) => {
              const saved = savedIds.has(String(h.exercise_id));
              return (
                <div
                  key={h.exercise_id}
                  className="py-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3 min-w-0"
                >
                  <div className="min-w-0 sm:flex-1">
                    <div className="text-sm font-medium truncate">{h.display_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground break-words whitespace-normal">
                      {h.modality}
                      {h.kind ? ` · ${h.kind}` : ""}
                      {h.brand_name ? ` · ${h.brand_name}` : ""}
                      {h.matched_source ? ` · ${h.matched_source}` : ""}
                    </div>
                    {h.matched_text ? (
                      <div className="mt-1 text-xs opacity-80 break-words whitespace-normal">
                        {h.matched_text}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex justify-end sm:ml-3 sm:shrink-0">
                    <button
                      type="button"
                      className="w-full sm:w-auto rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30 disabled:opacity-50"
                      onClick={() => void saveExercise(h)}
                      disabled={saved}
                      title={saved ? "Already saved" : "Save to My Training Library"}
                    >
                      {saved ? "Saved" : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Current exercises */}
      <div className="mt-10">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">My exercise library</div>
          {myLoading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : null}
        </div>

        {myExercises.length ? (
          <div className="mt-2 divide-y divide-muted/20">
            {myExercises.map((x) => (
              <div key={x.my_exercise_id} className="py-3 flex items-start justify-between gap-3 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-semibold text-blue-400">
                    {x.display_name}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground break-words whitespace-normal">
                    {x.modality}
                    {x.kind ? ` · ${x.kind}` : ""}
                    {x.brand_name ? ` · ${x.brand_name}` : ""}
                  </div>
                </div>

                <div className="grid shrink-0 justify-items-end gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/30"
                    onClick={() =>
                      setOpenExerciseActionsId((prev) =>
                        prev === x.my_exercise_id ? "" : x.my_exercise_id
                      )
                    }
                    aria-expanded={openExerciseActionsId === x.my_exercise_id}
                  >
                    Actions
                    {openExerciseActionsId === x.my_exercise_id ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>

                  {openExerciseActionsId === x.my_exercise_id ? (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-red-500">
                        Danger zone
                      </div>
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-600 hover:bg-red-500/10"
                        onClick={() => void removeExercise(x)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove exercise
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">
            Empty. Search above and click <span className="font-mono">Save</span>.
          </div>
        )}
      </div>
    </div>
  );
}
