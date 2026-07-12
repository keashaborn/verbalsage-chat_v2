"use client";

import * as React from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { NumericInput } from "@/components/lifeswitch/NumericInput";

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
  dose_type: string;
  dose_config: Record<string, unknown>;
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
function doseNumber(
  config: Record<string, unknown>,
  key: string
): string {
  const value = config?.[key];
  return value == null ? "" : String(value);
}

function doseString(
  config: Record<string, unknown>,
  key: string
): string {
  const value = config?.[key];
  return value == null ? "" : String(value);
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
  doseType: string;
  doseConfig: Record<string, unknown>;
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
  const [doseType, setDoseType] = React.useState("open");
  const [doseConfig, setDoseConfig] = React.useState<
    Record<string, unknown>
  >({});

  const selected = React.useMemo(() => {
    return prescriptions.find((p) => p.my_conditioning_prescription_id === selectedId) || null;
  }, [prescriptions, selectedId]);
  function setDoseField(
    key: string,
    value: string | number
  ) {
    setDoseConfig((current) => ({
      ...current,
      [key]: value,
    }));
  }


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
      setDoseType(String(draft.doseType || "open"));
      setDoseConfig(
        draft.doseConfig &&
          typeof draft.doseConfig === "object" &&
          !Array.isArray(draft.doseConfig)
          ? draft.doseConfig
          : {}
      );
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
        !!notes.trim() ||
        doseType !== "open" ||
        Object.keys(doseConfig).length > 0;

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
        doseType,
        doseConfig,
      };

      window.localStorage.setItem(CONDITIONING_CAPTURE_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [
    day,
    selectedId,
    durationMin,
    intensity,
    distance,
    heartRateAvg,
    notes,
    doseType,
    doseConfig,
  ]);



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
    setDoseType(selected.dose_type || "open");
    setDoseConfig(
      selected.dose_config &&
        typeof selected.dose_config === "object" &&
        !Array.isArray(selected.dose_config)
        ? selected.dose_config
        : {}
    );
  }, [selected, restoredDraft]);

  function discardConditioningDraft() {
    clearConditioningDraftStorage();
    setSelectedId("");
    setDurationMin("");
    setIntensity("");
    setDistance("");
    setHeartRateAvg("");
    setNotes("");
    setDoseType("open");
    setDoseConfig({});
    setRestoredDraft(false);
    setStatus("Discarded conditioning draft");
  }

  async function saveSession() {
    if (!selected) return;

    const duration = safeNum(durationMin, 0);
    if (doseType === "time" && (!duration || duration <= 0)) {
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
      qs.set("dose_type", doseType || "open");
      qs.set("dose_config", JSON.stringify(doseConfig || {}));

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
      setDoseType("open");
      setDoseConfig({});
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
                    <div className="text-muted-foreground">
                      Duration min
                    </div>
                    <NumericInput
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      mode="integer"
                      min={0}
                      step="1"
                      value={durationMin}
                      onValueChange={setDurationMin}
                    />
                  </label>

                  <label className="text-xs">
                    <div className="text-muted-foreground">
                      Intensity
                    </div>
                    <input
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={intensity}
                      onChange={(e) =>
                        setIntensity(e.currentTarget.value)
                      }
                      placeholder="easy, moderate, hard, RPE..."
                    />
                  </label>
                </div>

                <div className="rounded-xl border bg-background/40 p-3">
                  <div className="text-xs font-semibold">
                    {doseType === "open"
                      ? "Custom dose"
                      : doseType === "loaded_carry"
                        ? "Loaded carry"
                        : doseType.charAt(0).toUpperCase() +
                          doseType.slice(1)}
                  </div>

                  {doseType === "open" ? (
                    <label className="mt-3 block text-xs">
                      <div className="text-muted-foreground">
                        Dose description
                      </div>
                      <textarea
                      className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={doseString(
                          doseConfig,
                          "description"
                        )}
                        onChange={(e) =>
                          setDoseField(
                            "description",
                            e.currentTarget.value
                          )
                        }
                        placeholder="Describe what you completed."
                      />
                    </label>
                  ) : null}

                  {doseType === "time" ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Record the completed duration and intensity above.
                    </div>
                  ) : null}

                  {doseType === "distance" ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <DoseInput
                        label="Distance"
                        value={doseNumber(doseConfig, "distance")}
                        step="0.1"
                        onChange={(value) =>
                          setDoseField("distance", value)
                        }
                      />
                      <DoseTextInput
                        label="Distance unit"
                        value={doseString(
                          doseConfig,
                          "distance_unit"
                        )}
                        placeholder="miles, km, meters"
                        onChange={(value) =>
                          setDoseField("distance_unit", value)
                        }
                      />
                      <DoseInput
                        label="Actual time min"
                        value={doseNumber(
                          doseConfig,
                          "target_time_min"
                        )}
                        step="0.1"
                        onChange={(value) =>
                          setDoseField("target_time_min", value)
                        }
                      />
                      <DoseTextInput
                        label="Actual pace"
                        value={doseString(
                          doseConfig,
                          "target_pace"
                        )}
                        placeholder="15:00 per mile"
                        onChange={(value) =>
                          setDoseField("target_pace", value)
                        }
                      />
                    </div>
                  ) : null}

                  {doseType === "rounds" ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <DoseInput
                        label="Rounds completed"
                        value={doseNumber(doseConfig, "rounds")}
                        onChange={(value) =>
                          setDoseField("rounds", value)
                        }
                      />
                      <DoseInput
                        label="Work seconds"
                        value={doseNumber(
                          doseConfig,
                          "work_seconds"
                        )}
                        onChange={(value) =>
                          setDoseField("work_seconds", value)
                        }
                      />
                      <DoseInput
                        label="Rest seconds"
                        value={doseNumber(
                          doseConfig,
                          "rest_seconds"
                        )}
                        onChange={(value) =>
                          setDoseField("rest_seconds", value)
                        }
                      />
                    </div>
                  ) : null}

                  {doseType === "intervals" ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <DoseInput
                        label="Intervals completed"
                        value={doseNumber(
                          doseConfig,
                          "intervals"
                        )}
                        onChange={(value) =>
                          setDoseField("intervals", value)
                        }
                      />
                      <DoseInput
                        label="Work seconds"
                        value={doseNumber(
                          doseConfig,
                          "work_seconds"
                        )}
                        onChange={(value) =>
                          setDoseField("work_seconds", value)
                        }
                      />
                      <DoseInput
                        label="Rest seconds"
                        value={doseNumber(
                          doseConfig,
                          "rest_seconds"
                        )}
                        onChange={(value) =>
                          setDoseField("rest_seconds", value)
                        }
                      />
                    </div>
                  ) : null}

                  {doseType === "laps" ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <DoseInput
                        label="Laps completed"
                        value={doseNumber(doseConfig, "laps")}
                        onChange={(value) =>
                          setDoseField("laps", value)
                        }
                      />
                      <DoseInput
                        label="Distance per lap"
                        value={doseNumber(
                          doseConfig,
                          "distance_per_lap"
                        )}
                        step="0.1"
                        onChange={(value) =>
                          setDoseField(
                            "distance_per_lap",
                            value
                          )
                        }
                      />
                      <DoseTextInput
                        label="Distance unit"
                        value={doseString(
                          doseConfig,
                          "distance_unit"
                        )}
                        placeholder="feet, meters, yards"
                        onChange={(value) =>
                          setDoseField("distance_unit", value)
                        }
                      />
                    </div>
                  ) : null}

                  {doseType === "repetitions" ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <DoseInput
                        label="Sets completed"
                        value={doseNumber(doseConfig, "sets")}
                        onChange={(value) =>
                          setDoseField("sets", value)
                        }
                      />
                      <DoseInput
                        label="Repetitions completed"
                        value={doseNumber(
                          doseConfig,
                          "repetitions"
                        )}
                        onChange={(value) =>
                          setDoseField("repetitions", value)
                        }
                      />
                    </div>
                  ) : null}

                  {doseType === "loaded_carry" ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <DoseInput
                        label="Left-side load"
                        value={doseNumber(
                          doseConfig,
                          "load_left"
                        )}
                        step="0.5"
                        onChange={(value) =>
                          setDoseField("load_left", value)
                        }
                      />
                      <DoseInput
                        label="Right-side load"
                        value={doseNumber(
                          doseConfig,
                          "load_right"
                        )}
                        step="0.5"
                        onChange={(value) =>
                          setDoseField("load_right", value)
                        }
                      />
                      <DoseTextInput
                        label="Load unit"
                        value={doseString(
                          doseConfig,
                          "load_unit"
                        )}
                        placeholder="lb or kg"
                        onChange={(value) =>
                          setDoseField("load_unit", value)
                        }
                      />
                      <DoseInput
                        label="Laps completed"
                        value={doseNumber(doseConfig, "laps")}
                        onChange={(value) =>
                          setDoseField("laps", value)
                        }
                      />
                      <DoseInput
                        label="Distance"
                        value={doseNumber(
                          doseConfig,
                          "distance"
                        )}
                        step="0.1"
                        onChange={(value) =>
                          setDoseField("distance", value)
                        }
                      />
                      <DoseTextInput
                        label="Distance unit"
                        value={doseString(
                          doseConfig,
                          "distance_unit"
                        )}
                        placeholder="feet, meters, yards"
                        onChange={(value) =>
                          setDoseField("distance_unit", value)
                        }
                      />
                      <DoseInput
                        label="Rounds completed"
                        value={doseNumber(doseConfig, "rounds")}
                        onChange={(value) =>
                          setDoseField("rounds", value)
                        }
                      />
                      <DoseInput
                        label="Rest seconds"
                        value={doseNumber(
                          doseConfig,
                          "rest_seconds"
                        )}
                        onChange={(value) =>
                          setDoseField("rest_seconds", value)
                        }
                      />
                    </div>
                  ) : null}
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

function DoseInput({
  label,
  value,
  step = "1",
  onChange,
}: {
  label: string;
  value: string;
  step?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs">
      <div className="text-muted-foreground">{label}</div>
      <NumericInput
        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        mode={step.includes(".") ? "decimal" : "integer"}
        min={0}
        step={step}
        value={value}
        onValueChange={(next) => onChange(safeNum(next, 0))}
      />
    </label>
  );
}

function DoseTextInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs">
      <div className="text-muted-foreground">{label}</div>
      <input
        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        value={value}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.currentTarget.value)
        }
      />
    </label>
  );
}
