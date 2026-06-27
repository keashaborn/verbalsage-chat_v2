"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";

type SharedExercise = {
  workout_template_exercise_id: string;
  exercise_id: string;
  display_name_snapshot?: string | null;
  sort_order: number;
  set_type?: string | null;
  planned_sets: number;
  default_weight: number;
  default_reps: number;
  flags?: string | null;
  segments?: Array<{
    workout_template_exercise_segment_id: string;
    segment_index: number;
    label?: string | null;
    default_weight: number;
    default_reps: number;
  }>;
};

type Preview = {
  status: string;
  creator_display_name?: string | null;
  workout_name?: string | null;
  workout_notes?: string | null;
  expires_at?: string | null;
  exercises?: SharedExercise[];
};

async function fetchJson(url: string, init?: RequestInit, useAuth = false) {
  const f = useAuth ? authFetch : fetch;
  const r = await f(url, { cache: "no-store", ...(init || {}) });
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

export default function WorkoutSharePage({ params }: { params: Promise<{ token: string }> }) {
  const resolved = React.use(params);
  const token = resolved.token;

  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [signedIn, setSignedIn] = React.useState<boolean | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [importedId, setImportedId] = React.useState("");
  const [importStatus, setImportStatus] = React.useState("");

  React.useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");

      try {
        const j = (await fetchJson(
          `/api/lifeswitch/training/workout_template_shares/preview?token=${encodeURIComponent(token)}`
        )) as Preview;

        if (alive) setPreview(j);
      } catch (e: any) {
        if (alive) setErr(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    (async () => {
      try {
        const w = await fetchJson("/api/auth/whoami");
        if (alive) setSignedIn(Boolean(w?.ok && w?.sub));
      } catch {
        if (alive) setSignedIn(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  async function importWorkout() {
    setImporting(true);
    setImportStatus("");
    setImportedId("");

    try {
      const j = await fetchJson(
        `/api/lifeswitch/training/workout_template_shares/import?token=${encodeURIComponent(token)}`,
        { method: "POST" },
        true
      );

      const id = String(j?.imported_workout?.workout_template_id || "");
      setImportedId(id);
      setImportStatus(`Imported ${j?.imported_workout?.name || "workout"}.`);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("401") || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("not signed")) {
        setImportStatus("Import failed: please sign in first, then return to this link and import again.");
      } else {
        setImportStatus(`Import failed: ${msg}`);
      }
    } finally {
      setImporting(false);
    }
  }

  const exercises = Array.isArray(preview?.exercises) ? preview!.exercises! : [];
  const inactive = preview && preview.status !== "active";

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-card p-5 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          LifeSwitch Workout Share
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-muted-foreground">Loading shared workout…</div>
        ) : err ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
            {err}
          </div>
        ) : preview ? (
          <>
            <h1 className="mt-2 text-2xl font-semibold">
              {preview.workout_name || "Shared Workout"}
            </h1>

            <div className="mt-2 text-sm text-muted-foreground">
              Shared by {preview.creator_display_name || "another LifeSwitch user"}.
              {preview.expires_at ? ` Expires ${String(preview.expires_at).slice(0, 10)}.` : ""}
            </div>

            {preview.workout_notes ? (
              <div className="mt-3 rounded-xl border bg-muted/20 p-3 text-sm">{preview.workout_notes}</div>
            ) : null}

            {inactive ? (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                This share is {preview.status}. It cannot be imported.
              </div>
            ) : null}

            <section className="mt-5">
              <div className="text-sm font-semibold">Exercises</div>

              {exercises.length ? (
                <div className="mt-2 space-y-2">
                  {exercises.map((ex, idx) => {
                    const name = ex.display_name_snapshot || ex.exercise_id;
                    const segments = Array.isArray(ex.segments) ? ex.segments : [];

                    return (
                      <div key={ex.workout_template_exercise_id || `${ex.exercise_id}-${idx}`} className="rounded-xl border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {idx + 1}. {name}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {ex.set_type || "straight"} · {ex.planned_sets} sets · {ex.default_weight} × {ex.default_reps}
                            </div>
                          </div>
                        </div>

                        {segments.length ? (
                          <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                            {segments.map((seg) => (
                              <div key={seg.workout_template_exercise_segment_id}>
                                {seg.segment_index}. {seg.label || "Segment"} · {seg.default_weight} × {seg.default_reps}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">No exercises found in this shared workout.</div>
              )}
            </section>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted/30 disabled:opacity-50"
                onClick={() => void importWorkout()}
                disabled={importing || Boolean(inactive)}
              >
                {importing ? "Importing…" : "Import to My Workouts"}
              </button>

              <a className="rounded-xl border px-4 py-2 text-sm hover:bg-muted/30" href="/lifeswitch/training/design/workouts">
                Open Workouts
              </a>
            </div>

            {importStatus ? (
              <div className="mt-4 rounded-xl border bg-muted/20 p-3 text-sm">
                {importStatus}
                {importedId ? (
                  <div className="mt-2">
                    <a className="underline underline-offset-4" href="/lifeswitch/training/design/workouts">
                      View imported workout
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
