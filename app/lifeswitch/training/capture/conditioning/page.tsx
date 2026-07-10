"use client";

import * as React from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { selectNumberInputValue } from "@/components/lifeswitch/selectInputValue";

type MyConditioningPrescriptionRow = {
  my_conditioning_prescription_id: string;
  owner_user_id: string;
  conditioning_library_id?: string | null;
  name: string;
  category: string;
  modality: string;
  purpose: string;
  target_duration_min: number;
  target_frequency_per_week: number;
  target_intensity: string;
  preferred_timing: string;
  recovery_constraints: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

const CONDITIONING_CAPTURE_DRAFT_KEY = "lifeswitch:training:conditioning_capture_draft:v1";

type ConditioningCaptureDraft = {
  day: string;
  selectedId: string;
  durationMin: string;
  intensity: string;
  distance: string;
  heartRateAvg: string;
  notes: string;
};

export default function ConditioningCapturePage() {

  const [day, setDay] = React.useState(todayLocalYYYYMMDD());
  const [prescriptions, setPrescriptions] = React.useState<MyConditioningPrescriptionRow[]>([]);
  const [selectedId, setSelectedId] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [restoredDraft, setRestoredDraft] = React.useState(false);

  const [durationMin, setDurationMin] = React.useState("");
  const [intensity, setIntensity] = React.useState("");
  const [distance, setDistance] = React.useState("");
  const [heartRateAvg, setHeartRateAvg] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const selected = React.useMemo(() => {
    return prescriptions.find((p) => p.my_conditioning_prescription_id === selectedId) || null;
  }, [prescriptions, selectedId]);

  function clearConditioningDraftStorage() {
    try {
      window.localStorage.removeItem(CONDITIONING_CAPTURE_DRAFT_KEY);
    } catch {
      // ignore
    }
  }

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CONDITIONING_CAPTURE_DRAFT_KEY);
      if (!raw) return;

      const draft = JSON.parse(raw) as Partial<ConditioningCaptureDraft>;
      if (!draft || typeof draft !== "object") return;

      if (draft.day) setDay(String(draft.day));
      if (draft.selectedId) setSelectedId(String(draft.selectedId));
      setDurationMin(String(draft.durationMin || ""));
      setIntensity(String(draft.intensity || ""));
      setDistance(String(draft.distance || ""));
      setHeartRateAvg(String(draft.heartRateAvg || ""));
      setNotes(String(draft.notes || ""));
      setRestoredDraft(true);
      setStatus("Restored unfinished conditioning draft");
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    try {
      const hasDraft =
        !!selectedId ||
        !!durationMin.trim() ||
        !!intensity.trim() ||
        !!distance.trim() ||
        !!heartRateAvg.trim() ||
        !!notes.trim();

      if (!hasDraft) {
        window.localStorage.removeItem(CONDITIONING_CAPTURE_DRAFT_KEY);
        return;
      }

      const draft: ConditioningCaptureDraft = {
        day,
        selectedId,
        durationMin,
        intensity,
        distance,
        heartRateAvg,
        notes,
      };

      window.localStorage.setItem(CONDITIONING_CAPTURE_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [day, selectedId, durationMin, intensity, distance, heartRateAvg, notes]);



  const loadPrescriptions = React.useCallback(async () => {
    setLoading(true);
    setStatus("");

    try {
      const rows = (await fetchJson("/api/lifeswitch/training/my_conditioning_prescriptions")) as MyConditioningPrescriptionRow[];
      const arr = Array.isArray(rows) ? rows.filter((x) => x.is_active) : [];
      arr.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      setPrescriptions(arr);
    } catch (e: any) {
      setPrescriptions([]);
      setStatus(`Load failed: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);


  React.useEffect(() => {
    void loadPrescriptions();
  }, [loadPrescriptions]);

  React.useEffect(() => {
    if (!selected) return;
    if (restoredDraft) return;

    setDurationMin(String(selected.target_duration_min || ""));
    setIntensity(selected.target_intensity || "");
    setDistance("");
    setHeartRateAvg("");
    setNotes(selected.notes || "");
  }, [selected, restoredDraft]);

  function discardConditioningDraft() {
    clearConditioningDraftStorage();
    setSelectedId("");
    setDurationMin("");
    setIntensity("");
    setDistance("");
    setHeartRateAvg("");
    setNotes("");
    setRestoredDraft(false);
    setStatus("Discarded conditioning draft");
  }

  async function saveSession() {
    if (!selected) return;

    const duration = safeNum(durationMin, 0);
    if (!duration || duration <= 0) {
      setStatus("Enter duration.");
      return;
    }

    setSaving(true);
    setStatus("Saving conditioning session...");

    try {
      const qs = new URLSearchParams();
      qs.set("my_conditioning_prescription_id", selected.my_conditioning_prescription_id);
      qs.set("day", day);
      qs.set("name", selected.name);
      qs.set("category", selected.category || "");
      qs.set("modality", selected.modality || "");
      qs.set("duration_min", String(duration));
      qs.set("intensity", intensity || "");
      qs.set("distance", distance || "");
      if (heartRateAvg.trim()) qs.set("heart_rate_avg", String(safeNum(heartRateAvg, 0)));
      qs.set("recovery_impact", "");
      qs.set("notes", notes || "");

      await fetchJson(`/api/lifeswitch/training/conditioning_sessions/create?${qs.toString()}`, {
        method: "POST",
      });

      clearConditioningDraftStorage();
      setSelectedId("");
      setDurationMin("");
      setIntensity("");
      setDistance("");
      setHeartRateAvg("");
      setNotes("");
      setRestoredDraft(false);
      setStatus(`Saved ${selected.name}.`);
    } catch (e: any) {
      setStatus(`Save failed: ${String(e?.message || e)}`);
    } finally {
      setSaving(false);
    }
  }



  return (
    <div className="mx-auto max-w-5xl p-4">
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
        <Link
          href="/lifeswitch/training/capture"
          className="px-3 py-2 text-center hover:bg-muted/30"
        >
          Strength
        </Link>
        <div className="bg-muted px-3 py-2 text-center font-semibold">Conditioning</div>
      </div>

      {status ? <div className="mt-3 text-sm text-muted-foreground">{status}</div> : null}

      <div className="mt-6 grid gap-4">
        <aside className={selected ? "hidden" : "rounded-xl border p-4"}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Conditioning</div>
            <button
              type="button"
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted/30"
              onClick={() => void loadPrescriptions()}
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <select
            className="mt-3 w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={selectedId}
            onChange={(e) => {
              setRestoredDraft(false);
              setSelectedId(e.target.value);
            }}
          >
            <option value="">Select conditioning</option>
            {prescriptions.map((p) => (
              <option key={p.my_conditioning_prescription_id} value={p.my_conditioning_prescription_id}>
                {p.name}
              </option>
            ))}
          </select>

          {!selected && prescriptions.length === 0 ? (
            <div className="mt-4 rounded-xl border p-3 text-sm text-muted-foreground">
              No conditioning plans yet.
              Create one in Workouts.
            </div>
          ) : null}
        </aside>

        <main className={selected ? "rounded-xl border p-4" : "hidden"}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Active conditioning draft</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {selected?.name}
              </div>
            </div>
          </div>

          {selected ? (
            <div className="mt-4 grid gap-3 rounded-xl border border-blue-500/40 bg-blue-500/10 p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs">
                  <div className="text-muted-foreground">Duration min</div>
                  <input
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    type="number"
                    step="1"
                    value={durationMin}
                    onFocus={selectNumberInputValue}
                    onClick={selectNumberInputValue}
                    onChange={(e) => setDurationMin(e.currentTarget.value)}
                  />
                </label>

                <label className="text-xs">
                  <div className="text-muted-foreground">Intensity</div>
                  <input
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={intensity}
                    onChange={(e) => setIntensity(e.currentTarget.value)}
                    placeholder="easy, moderate, hard, RPE..."
                  />
                </label>

                <label className="text-xs">
                  <div className="text-muted-foreground">Distance / dose</div>
                  <input
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={distance}
                    onChange={(e) => setDistance(e.currentTarget.value)}
                    placeholder="4 laps, 1 mile, 3 rounds..."
                  />
                </label>

              </div>

              <label className="text-xs">
                <div className="text-muted-foreground">Notes</div>
                <textarea
                  className="mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={notes}
                  onChange={(e) => setNotes(e.currentTarget.value)}
                  placeholder="load, incline, speed, rounds, constraints..."
                />
              </label>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                  onClick={discardConditioningDraft}
                  disabled={saving}
                >
                  Discard draft
                </button>

                <button
                  type="button"
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                  onClick={() => void saveSession()}
                  disabled={!selected || saving}
                >
                  {saving ? "Saving..." : "Finish Session"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border p-4 text-sm text-muted-foreground">
              Select a conditioning prescription to log a session.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
