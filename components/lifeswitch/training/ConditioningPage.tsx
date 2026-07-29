"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { NumericInput } from "@/components/lifeswitch/NumericInput";

type ConditioningLibraryRow = {
  conditioning_library_id: string;
  slug: string;
  name: string;
  category: string;
  modality: string;
  purpose: string;
  default_duration_min: number;
  default_frequency_per_week: number;
  default_intensity: string;
  interference_risk: string;
  joint_stress: string;
  equipment: string;
  progression_notes: string;
  contraindication_notes: string;
  sort_order: number;
  is_active: boolean;
};

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
  library_slug?: string | null;
  library_name?: string | null;
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

function displayCategory(category: string) {
  return String(category || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function riskLabel(value: string) {
  return String(value || "").replaceAll("_", " ");
}

export default function ConditioningPage() {

  const [library, setLibrary] = React.useState<ConditioningLibraryRow[]>([]);
  const [prescriptions, setPrescriptions] = React.useState<MyConditioningPrescriptionRow[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = React.useState("");
  const [selectedPrescriptionId, setSelectedPrescriptionId] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [libraryOpen, setLibraryOpen] = React.useState(true);
  const [libraryTouched, setLibraryTouched] = React.useState(false);

  const selectedLibrary = React.useMemo(
    () => library.find((x) => x.conditioning_library_id === selectedLibraryId) || null,
    [library, selectedLibraryId]
  );

  const selectedPrescription = React.useMemo(
    () => prescriptions.find((x) => x.my_conditioning_prescription_id === selectedPrescriptionId) || null,
    [prescriptions, selectedPrescriptionId]
  );

  React.useEffect(() => {
    if (libraryTouched) return;
    setLibraryOpen(prescriptions.length === 0);
  }, [libraryTouched, prescriptions.length]);

  const libraryCategories = React.useMemo(() => {
    const vals = Array.from(new Set(library.map((x) => x.category).filter(Boolean)));
    vals.sort((a, b) => displayCategory(a).localeCompare(displayCategory(b)));
    return vals;
  }, [library]);

  const filteredLibrary = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    return library.filter((x) => {
      if (categoryFilter && x.category !== categoryFilter) return false;
      if (!q) return true;

      const hay = [
        x.name,
        x.category,
        x.modality,
        x.purpose,
        x.default_intensity,
        x.equipment,
        x.interference_risk,
        x.joint_stress,
        x.progression_notes,
        x.contraindication_notes,
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [library, query, categoryFilter]);



  const loadLibrary = React.useCallback(async () => {
    const rows = (await fetchJson("/api/lifeswitch/training/conditioning_library")) as ConditioningLibraryRow[];
    const arr = Array.isArray(rows) ? rows.filter((x) => x.is_active) : [];
    arr.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    setLibrary(arr);
  }, [selectedLibraryId]);

  const loadPrescriptions = React.useCallback(async () => {
    const rows = (await fetchJson("/api/lifeswitch/training/my_conditioning_prescriptions")) as MyConditioningPrescriptionRow[];
    const arr = Array.isArray(rows) ? rows.filter((x) => x.is_active) : [];
    arr.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
    setPrescriptions(arr);
  }, [selectedPrescriptionId]);


  React.useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  React.useEffect(() => {
    void loadPrescriptions();
  }, [loadPrescriptions]);

  async function addLibraryToMine(row: ConditioningLibraryRow) {
    setLoading(true);
    setStatus("");
    try {
      const qs = new URLSearchParams({
        conditioning_library_id: row.conditioning_library_id,
        name: row.name,
        category: row.category,
        modality: row.modality,
        purpose: row.purpose,
        target_duration_min: String(row.default_duration_min || 0),
        target_frequency_per_week: String(row.default_frequency_per_week || 0),
        target_intensity: row.default_intensity || "",
        preferred_timing: "",
        recovery_constraints: row.contraindication_notes || "",
        notes: row.progression_notes || "",
        dose_type: "open",
        dose_config: "{}",
      });

      const saved = (await fetchJson(`/api/lifeswitch/training/my_conditioning_prescriptions/upsert?${qs.toString()}`, {
        method: "POST",
      })) as MyConditioningPrescriptionRow;

      setStatus(`Added ${saved.name}`);
      setSelectedPrescriptionId(saved.my_conditioning_prescription_id);
      await loadPrescriptions();
    } catch (e: any) {
      setStatus(`Add failed: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function createCustomConditioningPlan() {
    const name = query.trim();
    if (!name) return;

    setLoading(true);
    setStatus("");

    try {
      const qs = new URLSearchParams({
        conditioning_library_id: "",
        name,
        category: "custom",
        modality: "custom",
        purpose: "",
        target_duration_min: "0",
        target_frequency_per_week: "0",
        target_intensity: "",
        preferred_timing: "",
        recovery_constraints: "",
        notes: "",
        dose_type: "open",
        dose_config: "{}",
      });

      const saved = (await fetchJson(
        `/api/lifeswitch/training/my_conditioning_prescriptions/upsert?${qs.toString()}`,
        {
          method: "POST",
        }
      )) as MyConditioningPrescriptionRow;

      setStatus(`Created ${saved.name}`);
      setSelectedLibraryId("");
      setSelectedPrescriptionId(
        saved.my_conditioning_prescription_id
      );
      setQuery("");
      setLibraryTouched(true);
      setLibraryOpen(false);

      await loadPrescriptions();
    } catch (e: any) {
      setStatus(
        `Create failed: ${String(e?.message || e)}`
      );
    } finally {
      setLoading(false);
    }
  }


  async function updatePrescription(patch: Partial<MyConditioningPrescriptionRow>) {
    if (!selectedPrescription) return;
    setLoading(true);
    setStatus("");
    try {
      const merged = { ...selectedPrescription, ...patch };
      const qs = new URLSearchParams({
        my_conditioning_prescription_id: merged.my_conditioning_prescription_id,
        conditioning_library_id: merged.conditioning_library_id || "",
        name: merged.name || "",
        category: merged.category || "",
        modality: merged.modality || "",
        purpose: merged.purpose || "",
        target_duration_min: String(merged.target_duration_min || 0),
        target_frequency_per_week: String(merged.target_frequency_per_week || 0),
        target_intensity: merged.target_intensity || "",
        preferred_timing: merged.preferred_timing || "",
        recovery_constraints: merged.recovery_constraints || "",
        notes: merged.notes || "",
        dose_type: merged.dose_type || "open",
        dose_config: JSON.stringify(merged.dose_config || {}),
      });

      const saved = (await fetchJson(`/api/lifeswitch/training/my_conditioning_prescriptions/upsert?${qs.toString()}`, {
        method: "POST",
      })) as MyConditioningPrescriptionRow;

      setStatus(`Saved ${saved.name}`);
      await loadPrescriptions();
      setSelectedPrescriptionId(saved.my_conditioning_prescription_id);
    } catch (e: any) {
      setStatus(`Save failed: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }

  const [openPrescriptionActions, setOpenPrescriptionActions] = React.useState(false);

  async function deactivatePrescription(id: string) {
    const prescription = prescriptions.find((p) => p.my_conditioning_prescription_id === id);
    const name = prescription?.name || "this plan";
    const ok = window.confirm(`Remove conditioning plan "${name}"?`);
    if (!ok) return;

    setLoading(true);
    setStatus("");
    try {
      await fetchJson(`/api/lifeswitch/training/my_conditioning_prescriptions/${encodeURIComponent(id)}/deactivate`, {
        method: "POST",
      });
      setStatus("Removed conditioning plan");
      setOpenPrescriptionActions(false);
      if (selectedPrescriptionId === id) setSelectedPrescriptionId("");
      await loadPrescriptions();
    } catch (e: any) {
      setStatus(`Remove failed: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }



  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Training · Conditioning</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Choose conditioning methods, save personal plans, then use Capture and Log to track completed sessions.
          </div>
          {status ? <div className="mt-2 text-sm text-muted-foreground">{status}</div> : null}
        </div>

        <button
          type="button"
          className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30"
          onClick={() => {
            setLibraryTouched(true);
            setLibraryOpen((v) => !v);
          }}
        >
          {libraryOpen ? "Hide library" : "Show library"}
        </button>
      </div>

        <div className="mt-6 grid gap-4">
          {libraryOpen ? (
            <section className="min-w-0 border-y border-border/50 py-4">
              <div className="text-sm font-semibold">
                Conditioning library
              </div>

              <input
                className="mt-3 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search walking, zone 2, bike, intervals..."
              />

              <div className="mt-3 flex flex-wrap gap-4 border-b border-border/50">
                <button
                  type="button"
                  className={`border-b-2 py-2 text-xs font-medium ${
                    !categoryFilter
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setCategoryFilter("")}
                >
                  All categories
                </button>

                {libraryCategories.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    className={`border-b-2 py-2 text-xs font-medium ${
                      categoryFilter === cat
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {displayCategory(cat)}
                  </button>
                ))}
              </div>

              <div className="mt-3 divide-y divide-border/50 border-y border-border/50">
                {filteredLibrary.map((row) => {
                  const active =
                    row.conditioning_library_id === selectedLibraryId;

                  return (
                    <div
                      key={row.conditioning_library_id}
                      className={`min-w-0 ${
                        active
                          ? "bg-muted/20"
                          : "hover:bg-muted/10"
                      }`}
                    >
                      <button
                        type="button"
                        className="w-full px-1 py-3 text-left"
                        onClick={() =>
                          setSelectedLibraryId(
                            active ? "" : row.conditioning_library_id
                          )
                        }
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {row.name}
                          </span>
                          <span className="text-[10px] font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">
                            Conditioning
                          </span>
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          {displayCategory(row.category)} · {row.modality} ·{" "}
                          {row.default_duration_min || "var"} min
                        </div>

                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Risk {riskLabel(row.interference_risk) || "—"} · Joint{" "}
                          {riskLabel(row.joint_stress) || "—"}
                        </div>

                        {row.equipment ? (
                          <div className="mt-1 truncate text-[11px] text-muted-foreground">
                            Equipment: {row.equipment}
                          </div>
                        ) : null}
                      </button>

                      {active && selectedLibrary ? (
                        <div className="grid gap-3 border-t border-border/50 px-1 py-4 text-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">
                                Selected conditioning method
                              </div>
                              <div className="mt-1 text-lg font-medium">
                                {selectedLibrary.name}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                              disabled={loading}
                              onClick={() =>
                                void addLibraryToMine(selectedLibrary)
                              }
                            >
                              Add to my plans
                            </button>
                          </div>

                          <div className="border-l-2 border-border/60 pl-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Purpose
                            </div>
                            <div className="mt-1">
                              {selectedLibrary.purpose}
                            </div>
                          </div>

                          <div className="grid gap-2 md:grid-cols-2">
                            <Info
                              label="Category"
                              value={displayCategory(selectedLibrary.category)}
                            />
                            <Info
                              label="Modality"
                              value={selectedLibrary.modality}
                            />
                            <Info
                              label="Default duration"
                              value={`${selectedLibrary.default_duration_min || 0} min`}
                            />
                            <Info
                              label="Default frequency"
                              value={`${selectedLibrary.default_frequency_per_week || 0}x/week`}
                            />
                            <Info
                              label="Intensity"
                              value={selectedLibrary.default_intensity}
                            />
                            <Info
                              label="Equipment"
                              value={selectedLibrary.equipment}
                            />
                            <Info
                              label="Interference risk"
                              value={riskLabel(selectedLibrary.interference_risk)}
                            />
                            <Info
                              label="Joint stress"
                              value={riskLabel(selectedLibrary.joint_stress)}
                            />
                          </div>

                          <Info
                            label="Progression"
                            value={selectedLibrary.progression_notes}
                          />

                          <Info
                            label="Cautions"
                            value={selectedLibrary.contraindication_notes}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                  {query.trim() &&
                  !categoryFilter &&
                  filteredLibrary.length === 0 ? (
                    <section className="border-y border-border/50 py-3">
                      <div className="text-sm text-muted-foreground">
                        No matching conditioning method.
                      </div>

                      <div className="mt-4 text-sm font-medium">
                        Need a custom conditioning plan?
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        Create “{query.trim()}” as a custom plan and
                        configure how it is tracked.
                      </div>

                      <button
                        type="button"
                        className="mt-3 rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                        onClick={() =>
                          void createCustomConditioningPlan()
                        }
                        disabled={loading || !query.trim()}
                      >
                        Create custom plan
                      </button>
                    </section>
                  ) : null}
              </div>
            </section>
          ) : null}

        <main className="grid min-w-0 gap-4">
          <section className="min-w-0 border-y border-border/50 py-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">My conditioning plans</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Saved conditioning plans available in Capture and Log.
                </div>
              </div>
              {selectedPrescriptionId ? (
                <button
                  type="button"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSelectedPrescriptionId("");
                    setOpenPrescriptionActions(false);
                  }}
                >
                  Close
                </button>
              ) : null}
            </div>

            {prescriptions.length ? (
              <div className="mt-4 divide-y divide-border/50 border-y border-border/50">
                {prescriptions.map((p) => {
                  const active =
                    p.my_conditioning_prescription_id === selectedPrescriptionId;

                  return (
                    <div
                      key={p.my_conditioning_prescription_id}
                      className={`min-w-0 ${active
                          ? "bg-muted/20"
                          : "hover:bg-muted/10"
                        }`}
                    >
                      <button
                        type="button"
                        className="w-full px-1 py-3 text-left"
                        onClick={() =>
                          setSelectedPrescriptionId(
                            active ? "" : p.my_conditioning_prescription_id
                          )
                        }
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {p.name}
                          </span>
                          <span className="text-[10px] font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">
                            Conditioning
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {p.target_duration_min || 0} min ·{" "}
                          {p.target_frequency_per_week || 0}x/week
                        </div>
                      </button>

                      {active && selectedPrescription ? (
                        <div className="grid gap-3 border-t border-border/50 px-1 py-4">
                          <div>
                            <div className="text-sm font-semibold">
                              Selected conditioning plan
                            </div>
                            <div className="mt-1 text-lg font-medium">
                              {selectedPrescription.name}
                            </div>
                          </div>

                          <EditText
                            label="Name"
                            value={selectedPrescription.name}
                            onSave={(value) =>
                              updatePrescription({ name: value })
                            }
                          />

                          <EditText
                            label="Purpose"
                            value={selectedPrescription.purpose}
                            onSave={(value) =>
                              updatePrescription({ purpose: value })
                            }
                            multiline
                          />

                          <div className="grid gap-3 md:grid-cols-2">
                            <EditNumber
                              label="Duration min"
                              value={selectedPrescription.target_duration_min}
                              onSave={(value) =>
                                updatePrescription({
                                  target_duration_min: value,
                                })
                              }
                            />

                            <EditNumber
                              label="Frequency / week"
                              value={
                                selectedPrescription.target_frequency_per_week
                              }
                              onSave={(value) =>
                                updatePrescription({
                                  target_frequency_per_week: value,
                                })
                              }
                              step="0.5"
                            />
                          </div>

                          <EditText
                            label="Intensity"
                            value={selectedPrescription.target_intensity}
                            onSave={(value) =>
                              updatePrescription({
                                target_intensity: value,
                              })
                            }
                          />

                          <ConditioningDoseEditor
                            plan={selectedPrescription}
                            onSave={(patch) =>
                              updatePrescription(patch)
                            }
                          />

                          <EditText
                            label="Preferred timing"
                            value={selectedPrescription.preferred_timing}
                            placeholder="After lifting, separate day, post-meal, morning..."
                            onSave={(value) =>
                              updatePrescription({
                                preferred_timing: value,
                              })
                            }
                          />

                          <EditText
                            label="Recovery constraints"
                            value={selectedPrescription.recovery_constraints}
                            onSave={(value) =>
                              updatePrescription({
                                recovery_constraints: value,
                              })
                            }
                            multiline
                          />

                          <EditText
                            label="Notes"
                            value={selectedPrescription.notes}
                            onSave={(value) =>
                              updatePrescription({ notes: value })
                            }
                            multiline
                          />

                          <div className="grid justify-items-start gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/30 disabled:opacity-50"
                              onClick={() =>
                                setOpenPrescriptionActions((v) => !v)
                              }
                              disabled={loading}
                              aria-expanded={openPrescriptionActions}
                            >
                              Actions
                              {openPrescriptionActions ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>

                            {openPrescriptionActions ? (
                              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-red-500">
                                  Danger zone
                                </div>

                                <button
                                  type="button"
                                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                                  onClick={() =>
                                    void deactivatePrescription(
                                      selectedPrescription.my_conditioning_prescription_id
                                    )
                                  }
                                  disabled={loading}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Remove plan
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 grid gap-3 text-sm text-muted-foreground">
                <div>
                  No conditioning plans yet. Select a method above and add it.
                </div>

                {!libraryOpen ? (
                  <button
                    type="button"
                    className="justify-self-start rounded-xl border px-3 py-2 text-sm text-foreground hover:bg-muted/30"
                    onClick={() => {
                      setLibraryTouched(true);
                      setLibraryOpen(true);
                    }}
                  >
                    Show conditioning library
                  </button>
                ) : null}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-l-2 border-border/60 pl-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value || "—"}</div>
    </div>
  );
}

function doseNumber(
  config: Record<string, unknown>,
  key: string
): number {
  const value = config?.[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number(value || 0);
}

function doseString(
  config: Record<string, unknown>,
  key: string
): string {
  const value = config?.[key];
  return value == null ? "" : String(value);
}

function ConditioningDoseEditor({
  plan,
  onSave,
}: {
  plan: MyConditioningPrescriptionRow;
  onSave: (
    patch: Partial<MyConditioningPrescriptionRow>
  ) => void | Promise<void>;
}) {
  const doseType = plan.dose_type || "open";
  const config = plan.dose_config || {};

  function saveConfig(patch: Record<string, unknown>) {
    return onSave({
      dose_config: {
        ...config,
        ...patch,
      },
    });
  }

  return (
    <section className="grid gap-3 border-y border-border/50 py-3">
      <label className="grid gap-1">
        <div className="text-xs font-medium text-muted-foreground">
          Tracking method
        </div>

        <select
          className="rounded-xl border bg-background px-3 py-2 text-sm"
          value={doseType}
          onChange={(e) =>
            void onSave({
              dose_type: e.target.value,
              dose_config: {},
            })
          }
        >
          <option value="open">Custom / open</option>
          <option value="time">Time</option>
          <option value="distance">Distance</option>
          <option value="rounds">Rounds</option>
          <option value="intervals">Intervals</option>
          <option value="laps">Laps</option>
          <option value="repetitions">Repetitions</option>
          <option value="loaded_carry">Loaded carry</option>
        </select>
      </label>

      {doseType === "open" ? (
        <EditText
          label="Dose description"
          value={doseString(config, "description")}
          placeholder="Describe how this conditioning plan is performed."
          onSave={(value) =>
            saveConfig({ description: value })
          }
          multiline
        />
      ) : null}

      {doseType === "time" ? (
        <div className="text-xs text-muted-foreground">
          Use Duration and Intensity above to define this time-based plan.
        </div>
      ) : null}

      {doseType === "distance" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <EditNumber
            label="Distance"
            value={doseNumber(config, "distance")}
            step="0.1"
            onSave={(value) =>
              saveConfig({ distance: value })
            }
          />

          <EditText
            label="Distance unit"
            value={doseString(config, "distance_unit")}
            placeholder="miles, km, meters, yards"
            onSave={(value) =>
              saveConfig({ distance_unit: value })
            }
          />

          <EditNumber
            label="Target time min"
            value={doseNumber(config, "target_time_min")}
            step="0.1"
            onSave={(value) =>
              saveConfig({ target_time_min: value })
            }
          />

          <EditText
            label="Target pace"
            value={doseString(config, "target_pace")}
            placeholder="15:00 per mile"
            onSave={(value) =>
              saveConfig({ target_pace: value })
            }
          />
        </div>
      ) : null}

      {doseType === "rounds" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <EditNumber
            label="Rounds"
            value={doseNumber(config, "rounds")}
            onSave={(value) =>
              saveConfig({ rounds: value })
            }
          />

          <EditNumber
            label="Work seconds"
            value={doseNumber(config, "work_seconds")}
            onSave={(value) =>
              saveConfig({ work_seconds: value })
            }
          />

          <EditNumber
            label="Rest seconds"
            value={doseNumber(config, "rest_seconds")}
            onSave={(value) =>
              saveConfig({ rest_seconds: value })
            }
          />
        </div>
      ) : null}

      {doseType === "intervals" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <EditNumber
            label="Intervals"
            value={doseNumber(config, "intervals")}
            onSave={(value) =>
              saveConfig({ intervals: value })
            }
          />

          <EditNumber
            label="Work seconds"
            value={doseNumber(config, "work_seconds")}
            onSave={(value) =>
              saveConfig({ work_seconds: value })
            }
          />

          <EditNumber
            label="Rest seconds"
            value={doseNumber(config, "rest_seconds")}
            onSave={(value) =>
              saveConfig({ rest_seconds: value })
            }
          />
        </div>
      ) : null}

      {doseType === "laps" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <EditNumber
            label="Laps"
            value={doseNumber(config, "laps")}
            onSave={(value) =>
              saveConfig({ laps: value })
            }
          />

          <EditNumber
            label="Distance per lap"
            value={doseNumber(config, "distance_per_lap")}
            step="0.1"
            onSave={(value) =>
              saveConfig({ distance_per_lap: value })
            }
          />

          <EditText
            label="Distance unit"
            value={doseString(config, "distance_unit")}
            placeholder="feet, meters, yards"
            onSave={(value) =>
              saveConfig({ distance_unit: value })
            }
          />
        </div>
      ) : null}

      {doseType === "repetitions" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <EditNumber
            label="Sets"
            value={doseNumber(config, "sets")}
            onSave={(value) =>
              saveConfig({ sets: value })
            }
          />

          <EditNumber
            label="Repetitions"
            value={doseNumber(config, "repetitions")}
            onSave={(value) =>
              saveConfig({ repetitions: value })
            }
          />
        </div>
      ) : null}

      {doseType === "loaded_carry" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <EditNumber
            label="Left-side load"
            value={doseNumber(config, "load_left")}
            step="0.5"
            onSave={(value) =>
              saveConfig({ load_left: value })
            }
          />

          <EditNumber
            label="Right-side load"
            value={doseNumber(config, "load_right")}
            step="0.5"
            onSave={(value) =>
              saveConfig({ load_right: value })
            }
          />

          <EditText
            label="Load unit"
            value={doseString(config, "load_unit")}
            placeholder="lb or kg"
            onSave={(value) =>
              saveConfig({ load_unit: value })
            }
          />

          <EditNumber
            label="Laps"
            value={doseNumber(config, "laps")}
            onSave={(value) =>
              saveConfig({ laps: value })
            }
          />

          <EditNumber
            label="Distance"
            value={doseNumber(config, "distance")}
            step="0.1"
            onSave={(value) =>
              saveConfig({ distance: value })
            }
          />

          <EditText
            label="Distance unit"
            value={doseString(config, "distance_unit")}
            placeholder="feet, meters, yards"
            onSave={(value) =>
              saveConfig({ distance_unit: value })
            }
          />

          <EditNumber
            label="Rounds"
            value={doseNumber(config, "rounds")}
            onSave={(value) =>
              saveConfig({ rounds: value })
            }
          />

          <EditNumber
            label="Rest seconds"
            value={doseNumber(config, "rest_seconds")}
            onSave={(value) =>
              saveConfig({ rest_seconds: value })
            }
          />
        </div>
      ) : null}
    </section>
  );
}


function EditText({
  label,
  value,
  placeholder,
  multiline = false,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onSave: (value: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = React.useState(value || "");

  React.useEffect(() => {
    setDraft(value || "");
  }, [value]);

  return (
    <label className="grid gap-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {multiline ? (
        <textarea
          className="min-h-20 rounded-xl border bg-background px-3 py-2 text-sm"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void onSave(draft)}
        />
      ) : (
        <input
          className="rounded-xl border bg-background px-3 py-2 text-sm"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void onSave(draft)}
        />
      )}
    </label>
  );
}

function EditNumber({
  label,
  value,
  step = "1",
  onSave,
}: {
  label: string;
  value: number;
  step?: string;
  onSave: (value: number) => void | Promise<void>;
}) {
  const [draft, setDraft] = React.useState(String(value ?? 0));

  React.useEffect(() => {
    setDraft(String(value ?? 0));
  }, [value]);

  return (
    <label className="grid gap-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <NumericInput
        className="rounded-xl border bg-background px-3 py-2 text-sm"
        mode={step.includes(".") ? "decimal" : "integer"}
        min={0}
        required
        step={step}
        value={draft}
        onValueChange={setDraft}
        onBlur={() => void onSave(Number(draft || 0))}
      />
    </label>
  );
}
