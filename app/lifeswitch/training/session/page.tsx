"use client";

import * as React from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const WORKOUT_SET_VID = "1a2cad49-4972-43d7-9ba8-6031cd3c7657";

type WorkoutSetData = {
  date: string; // YYYY-MM-DD
  workout: string;
  exercise: string;
  set_index: number;
  weight: number;
  reps: number;
  count: number;
  __vs_sort_ts: string;
};

type FormsEntry = {
  id: string;
  owner_user_id: string;
  subject_id: string;
  template_version_id: string;
  occurred_at: string;
  data: WorkoutSetData;
};

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function groupByExercise(sets: FormsEntry[]) {
  const m = new Map<string, FormsEntry[]>();
  for (const r of sets) {
    const ex = String(r?.data?.exercise || "").trim();
    if (!ex) continue;
    const arr = m.get(ex) || [];
    arr.push(r);
    m.set(ex, arr);
  }
  // preserve deterministic ordering via __vs_sort_ts
  const out: Array<{ exercise: string; sets: FormsEntry[] }> = [];
  for (const [exercise, arr] of m.entries()) {
    arr.sort((a, b) => String(a?.data?.__vs_sort_ts || a?.occurred_at || "").localeCompare(String(b?.data?.__vs_sort_ts || b?.occurred_at || "")));
    out.push({ exercise, sets: arr });
  }
  // order exercises by first set sort_ts
  out.sort((a, b) => {
    const sa = String(a.sets[0]?.data?.__vs_sort_ts || a.sets[0]?.occurred_at || "");
    const sb = String(b.sets[0]?.data?.__vs_sort_ts || b.sets[0]?.occurred_at || "");
    return sa.localeCompare(sb);
  });
  return out;
}

export default function TrainingSessionPage() {
  const [ownerUserId, setOwnerUserId] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("auth: loading…");
  const [sets, setSets] = React.useState<FormsEntry[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const date = String(sp.get("date") || "").trim();
  const workout = String(sp.get("workout") || "").trim();

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setStatus("auth: loading…");

      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user?.id) {
          if (cancelled) return;
          setOwnerUserId("");
          setSets([]);
          setStatus("auth: not signed in");
          return;
        }

        const uid = data.user.id;
        if (cancelled) return;
        setOwnerUserId(uid);

        if (!date || !workout) {
          setSets([]);
          setStatus("missing date/workout query params");
          return;
        }

        setStatus("loading workout sets…");

        // pull a chunk, then filter client-side (MVP)
        const u = new URL("/api/forms/entries/list", window.location.origin);
        u.searchParams.set("owner_user_id", uid);
        u.searchParams.set("template_version_id", WORKOUT_SET_VID);
        u.searchParams.set("limit", "5000");

        const r = await fetch(u.toString(), { cache: "no-store" });
        const t = await r.text().catch(() => "");
        if (!r.ok) throw new Error(`entries/list failed: HTTP ${r.status} ${t.slice(0, 400)}`);

        const j = JSON.parse(t);
        const all = Array.isArray(j) ? (j as FormsEntry[]) : [];
        const filtered = all.filter((x) => String(x?.data?.date || "").trim() === date && String(x?.data?.workout || "").trim() === workout);

        // stable sort for display
        filtered.sort((a, b) => String(a?.data?.__vs_sort_ts || a?.occurred_at || "").localeCompare(String(b?.data?.__vs_sort_ts || b?.occurred_at || "")));

        if (cancelled) return;
        setSets(filtered);
        setStatus(`loaded ${filtered.length} sets`);
      } catch (e: any) {
        if (cancelled) return;
        setSets([]);
        setStatus(`error: ${e?.message || String(e)}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [date, workout]);

  const summary = React.useMemo(() => {
    const setCount = sets.length;
    const exercises = new Set<string>();
    let volume = 0;
    for (const r of sets) {
      exercises.add(String(r?.data?.exercise || "").trim());
      volume += safeNum(r?.data?.count, 0);
    }
    return {
      setCount,
      exerciseCount: Array.from(exercises).filter(Boolean).length,
      volume: Number(volume.toFixed(2)),
    };
  }, [sets]);

  const byExercise = React.useMemo(() => groupByExercise(sets), [sets]);

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="text-lg font-semibold">{workout || "Session"}</div>
      <div className="mt-1 text-sm text-muted-foreground">
        {date ? date : "—"} · sets={summary.setCount} · exercises={summary.exerciseCount} · volume={summary.volume} · time=—
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-muted-foreground">Debug</summary>
        <div className="mt-2 space-y-1 text-xs font-mono text-muted-foreground">
          <div>auth: {ownerUserId ? ownerUserId : "not signed in"}</div>
          <div>status: {status}</div>
        </div>
      </details>

      <div className="mt-8">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !date || !workout ? (
          <div className="text-sm text-muted-foreground">Missing query params. Need ?date=YYYY-MM-DD&workout=...</div>
        ) : sets.length === 0 ? (
          <div className="text-sm text-muted-foreground">No sets found for this session.</div>
        ) : (
          <div className="space-y-10">
            {byExercise.map((blk) => (
              <section key={blk.exercise}>
                <div className="text-base font-semibold">{blk.exercise}</div>
                <div className="mt-3 divide-y divide-muted/20">
                  {blk.sets.map((r) => (
                    <div key={r.id} className="py-3 text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="opacity-70">Set {r.data.set_index}</div>
                        <div className="font-mono">
                          {r.data.weight} × {r.data.reps}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 text-sm text-muted-foreground">
        Next: “Repeat” → draft entry page (editable sets + checkmarks + add set/exercise).
      </div>
    </div>
  );
}
