"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { selectNumberInputValue } from "@/components/lifeswitch/selectInputValue";

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
    <div className="mx-auto w-full max-w-6xl overflow-x-hidden p-4">
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

      <div className={libraryOpen ? "mt-6 grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]" : "mt-6 grid gap-4"}>
        {libraryOpen ? (
          <aside className="min-w-0 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Conditioning library</div>
              <div className="text-xs text-muted-foreground">count={filteredLibrary.length}</div>
            </div>

            <input
              className="mt-3 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search walking, zone 2, bike, intervals..."
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-full border px-3 py-1 text-xs ${!categoryFilter ? "border-foreground bg-foreground text-background" : "hover:bg-muted/10"}`}
                onClick={() => setCategoryFilter("")}
              >
                All categories
              </button>

              {libraryCategories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  className={`rounded-full border px-3 py-1 text-xs ${categoryFilter === cat ? "border-foreground bg-foreground text-background" : "hover:bg-muted/10"}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {displayCategory(cat)}
                </button>
              ))}
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              Current filter: {categoryFilter ? displayCategory(categoryFilter) : "All categories"}
            </div>

            <div className="mt-3 space-y-2">
              {filteredLibrary.map((row) => {
                const active = row.conditioning_library_id === selectedLibraryId;
                return (
                  <button
                    type="button"
                    key={row.conditioning_library_id}
                    className={`w-full rounded-xl border px-3 py-2 text-left ${active ? "border-foreground bg-muted/40 ring-1 ring-foreground/60" : "hover:bg-muted/10"}`}
                    onClick={() => setSelectedLibraryId(row.conditioning_library_id)}
                  >
                    <div className="text-sm font-medium">{row.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {displayCategory(row.category)} · {row.modality} · {row.default_duration_min || "var"} min
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Risk {riskLabel(row.interference_risk) || "—"} · Joint {riskLabel(row.joint_stress) || "—"}
                    </div>
                    {row.equipment ? (
                      <div className="mt-1 truncate text-[11px] text-muted-foreground">Equipment: {row.equipment}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </aside>
        ) : null}

        <main className="grid min-w-0 gap-4">
          {libraryOpen ? (
            <section className="min-w-0 rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Selected method</div>
                  <div className="mt-1 text-lg font-medium">{selectedLibrary?.name || "Select a method"}</div>
                </div>

                <button
                  type="button"
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                  disabled={!selectedLibrary || loading}
                  onClick={() => selectedLibrary && void addLibraryToMine(selectedLibrary)}
                >
                  Add to my plans
                </button>
              </div>

              {selectedLibrary ? (
                <div className="mt-4 grid gap-3 text-sm">
                  <div className="rounded-xl border p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Purpose</div>
                    <div className="mt-1">{selectedLibrary.purpose}</div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <Info label="Category" value={displayCategory(selectedLibrary.category)} />
                    <Info label="Modality" value={selectedLibrary.modality} />
                    <Info label="Default duration" value={`${selectedLibrary.default_duration_min || 0} min`} />
                    <Info label="Default frequency" value={`${selectedLibrary.default_frequency_per_week || 0}x/week`} />
                    <Info label="Intensity" value={selectedLibrary.default_intensity} />
                    <Info label="Equipment" value={selectedLibrary.equipment} />
                    <Info label="Interference risk" value={riskLabel(selectedLibrary.interference_risk)} />
                    <Info label="Joint stress" value={riskLabel(selectedLibrary.joint_stress)} />
                  </div>

                  <Info label="Progression" value={selectedLibrary.progression_notes} />
                  <Info label="Cautions" value={selectedLibrary.contraindication_notes} />
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="min-w-0 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">My conditioning plans</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Saved conditioning plans available in Capture and Log.
                </div>
              </div>
              <div className="text-xs text-muted-foreground">count={prescriptions.length}</div>
            </div>

            {prescriptions.length ? (
              <div className="mt-4 space-y-2">
                {prescriptions.map((p) => {
                  const active =
                    p.my_conditioning_prescription_id === selectedPrescriptionId;

                  return (
                    <div
                      key={p.my_conditioning_prescription_id}
                      className={`min-w-0 rounded-xl border ${active
                          ? "border-foreground bg-muted/20 ring-1 ring-foreground/60"
                          : ""
                        }`}
                    >
                      <button
                        type="button"
                        className="w-full px-3 py-3 text-left hover:bg-muted/10"
                        onClick={() =>
                          setSelectedPrescriptionId(
                            active ? "" : p.my_conditioning_prescription_id
                          )
                        }
                      >
                        <div className="text-sm font-semibold text-blue-400">
                          {p.name}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {p.target_duration_min || 0} min ·{" "}
                          {p.target_frequency_per_week || 0}x/week
                        </div>
                      </button>

                      {active && selectedPrescription ? (
                        <div className="grid gap-3 border-t p-3">
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
    <div className="rounded-xl border p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value || "—"}</div>
    </div>
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
      <input
        className="rounded-xl border bg-background px-3 py-2 text-sm"
        type="number"
        step={step}
        value={draft}
        onFocus={selectNumberInputValue}
        onClick={selectNumberInputValue}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void onSave(Number(draft || 0))}
      />
    </label>
  );
}
