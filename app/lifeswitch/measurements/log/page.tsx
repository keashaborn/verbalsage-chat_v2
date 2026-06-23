"use client";

import * as React from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";

export const dynamic = "force-dynamic";

type MeasurementEntry = {
  measurement_entry_id: string;
  local_date: string;
  weight_value?: number | null;
  weight_unit?: string | null;
  waist_value?: number | null;
  abdomen_value?: number | null;
  neck_value?: number | null;
  chest_value?: number | null;
  hip_value?: number | null;
  left_arm_value?: number | null;
  right_arm_value?: number | null;
  left_thigh_value?: number | null;
  right_thigh_value?: number | null;
  left_calf_value?: number | null;
  right_calf_value?: number | null;
  body_fat_percent?: number | null;
  body_fat_method?: string | null;
  measurement_unit?: string | null;
  source?: string | null;
  entry_kind?: string | null;
  notes?: string | null;
  skinfolds_json?: any;
  scan_json?: any;
  created_at?: string | null;
  updated_at?: string | null;
};

async function fetchJson(url: string, init?: RequestInit) {
  const res = await authFetch(url, { ...init, cache: "no-store" });
  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const detail = typeof data === "object" && data ? data.detail || data.error : text;
    throw new Error(String(detail || `HTTP ${res.status}`));
  }

  return data;
}

function objectJson(v: unknown): any {
  if (!v) return {};
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function displayKind(k?: string | null) {
  if (k === "weight") return "Weight";
  if (k === "tape") return "Tape";
  if (k === "skinfolds") return "Skinfolds";
  if (k === "scan") return "Scan";
  return k || "General";
}

function entrySummary(entry: MeasurementEntry): string {
  const kind = entry.entry_kind || "general";
  const parts: string[] = [];
  const skinfolds = objectJson(entry.skinfolds_json);
  const scan = objectJson(entry.scan_json);

  if (kind === "weight") {
    if (entry.weight_value != null) parts.push(`${entry.weight_value} ${entry.weight_unit || "lb"}`);
    if (entry.body_fat_percent != null) parts.push(`scale BF ${entry.body_fat_percent}%`);
    return parts.length ? parts.join(" · ") : "Weight entry";
  }

  if (kind === "tape") {
    if (entry.waist_value != null) parts.push(`waist ${entry.waist_value}`);
    if (entry.abdomen_value != null) parts.push(`abdomen ${entry.abdomen_value}`);
    if (entry.chest_value != null) parts.push(`chest ${entry.chest_value}`);
    if (entry.hip_value != null) parts.push(`hip ${entry.hip_value}`);
    return parts.length ? parts.join(" · ") : "Tape entry";
  }

  if (kind === "skinfolds") {
    if (entry.body_fat_percent != null) parts.push(`BF ${entry.body_fat_percent}%`);
    if (skinfolds?.sum7 != null) parts.push(`sum ${Math.round(Number(skinfolds.sum7) * 10) / 10} mm`);
    return parts.length ? parts.join(" · ") : "Skinfold entry";
  }

  if (kind === "scan") {
    if (entry.weight_value != null) parts.push(`${entry.weight_value} ${entry.weight_unit || "lb"}`);
    if (entry.body_fat_percent != null) parts.push(`BF ${entry.body_fat_percent}%`);
    if (scan?.fat_mass_lb != null) parts.push(`fat mass ${scan.fat_mass_lb} lb`);
    if (scan?.lean_mass_lb != null) parts.push(`lean mass ${scan.lean_mass_lb} lb`);
    return parts.length ? parts.join(" · ") : "Scan entry";
  }

  if (entry.weight_value != null) parts.push(`${entry.weight_value} ${entry.weight_unit || "lb"}`);
  if (entry.waist_value != null) parts.push(`waist ${entry.waist_value}`);
  if (entry.body_fat_percent != null) parts.push(`BF ${entry.body_fat_percent}%`);
  return parts.length ? parts.join(" · ") : "Measurement entry";
}

function detailRows(entry: MeasurementEntry): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const skinfolds = objectJson(entry.skinfolds_json);
  const sites = objectJson(skinfolds?.sites);
  const scan = objectJson(entry.scan_json);

  const push = (label: string, value: unknown, suffix = "") => {
    if (value == null || value === "") return;
    rows.push([label, `${value}${suffix}`]);
  };

  push("Date", entry.local_date);
  push("Type", displayKind(entry.entry_kind));
  push("Source", entry.source);
  push("Weight", entry.weight_value, entry.weight_unit ? ` ${entry.weight_unit}` : " lb");
  push("Body fat", entry.body_fat_percent, "%");
  push("Body-fat method", entry.body_fat_method);

  push("Waist", entry.waist_value, entry.measurement_unit ? ` ${entry.measurement_unit}` : " in");
  push("Abdomen", entry.abdomen_value, entry.measurement_unit ? ` ${entry.measurement_unit}` : " in");
  push("Neck", entry.neck_value, entry.measurement_unit ? ` ${entry.measurement_unit}` : " in");
  push("Chest", entry.chest_value, entry.measurement_unit ? ` ${entry.measurement_unit}` : " in");
  push("Hip", entry.hip_value, entry.measurement_unit ? ` ${entry.measurement_unit}` : " in");

  push("Left arm", entry.left_arm_value, entry.measurement_unit ? ` ${entry.measurement_unit}` : " in");
  push("Right arm", entry.right_arm_value, entry.measurement_unit ? ` ${entry.measurement_unit}` : " in");
  push("Left thigh", entry.left_thigh_value, entry.measurement_unit ? ` ${entry.measurement_unit}` : " in");
  push("Right thigh", entry.right_thigh_value, entry.measurement_unit ? ` ${entry.measurement_unit}` : " in");
  push("Left calf", entry.left_calf_value, entry.measurement_unit ? ` ${entry.measurement_unit}` : " in");
  push("Right calf", entry.right_calf_value, entry.measurement_unit ? ` ${entry.measurement_unit}` : " in");

  push("Skinfold protocol", skinfolds?.protocol);
  push("Skinfold age", skinfolds?.age);
  push("Skinfold sum", skinfolds?.sum7, " mm");
  push("Chest skinfold", sites?.chest, " mm");
  push("Abdomen skinfold", sites?.abdomen, " mm");
  push("Thigh skinfold", sites?.thigh, " mm");
  push("Triceps skinfold", sites?.triceps, " mm");
  push("Subscapular skinfold", sites?.subscapular, " mm");
  push("Suprailiac skinfold", sites?.suprailiac, " mm");
  push("Midaxillary skinfold", sites?.midaxillary, " mm");

  push("Scan type", scan?.scan_type);
  push("Facility/device", scan?.facility_or_device);
  push("Fat mass", scan?.fat_mass_lb, " lb");
  push("Lean mass", scan?.lean_mass_lb, " lb");
  push("Bone mass / BMC", scan?.bone_mass_lb, " lb");
  push("Visceral fat / VAT", scan?.visceral_fat);
  push("Skeletal muscle mass", scan?.skeletal_muscle_mass_lb, " lb");

  push("Created", entry.created_at);
  push("Updated", entry.updated_at);

  return rows;
}

function latestOf(entries: MeasurementEntry[], kind: string) {
  return entries.find((e) => e.entry_kind === kind) || null;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export default function MeasurementsLogPage() {
  const [entries, setEntries] = React.useState<MeasurementEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState("");

  async function loadEntries() {
    setLoading(true);
    setStatus("");

    try {
      const rows = (await fetchJson("/api/lifeswitch/measurements/entries?limit=250")) as MeasurementEntry[];
      setEntries(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setStatus(String(e?.message || e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadEntries();
  }, []);

  const latestWeight = latestOf(entries, "weight");
  const latestTape = latestOf(entries, "tape");
  const latestSkinfolds = latestOf(entries, "skinfolds");
  const latestScan = latestOf(entries, "scan");

  const byDate = React.useMemo(() => {
    const m = new Map<string, MeasurementEntry[]>();

    for (const entry of entries) {
      const key = entry.local_date || "undated";
      const arr = m.get(key) || [];
      arr.push(entry);
      m.set(key, arr);
    }

    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  return (
    <div className="mx-auto max-w-5xl p-4 pb-28">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Measurements · Log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review weight, tape, skinfold, and body-scan measurement history.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30"
            onClick={() => void loadEntries()}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <Link
            href="/lifeswitch/measurements/capture"
            className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30"
          >
            Add entry
          </Link>
        </div>
      </div>

      {status ? <div className="mt-4 text-sm text-red-600">{status}</div> : null}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard
          label="Latest weight"
          value={latestWeight?.weight_value != null ? `${latestWeight.weight_value} ${latestWeight.weight_unit || "lb"}` : "—"}
          sub={latestWeight?.local_date}
        />
        <StatCard
          label="Latest waist"
          value={latestTape?.waist_value != null ? `${latestTape.waist_value} ${latestTape.measurement_unit || "in"}` : "—"}
          sub={latestTape?.local_date}
        />
        <StatCard
          label="Latest body fat"
          value={
            latestSkinfolds?.body_fat_percent != null
              ? `${latestSkinfolds.body_fat_percent}%`
              : latestScan?.body_fat_percent != null
                ? `${latestScan.body_fat_percent}%`
                : latestWeight?.body_fat_percent != null
                  ? `${latestWeight.body_fat_percent}%`
                  : "—"
          }
          sub={latestSkinfolds?.local_date || latestScan?.local_date || latestWeight?.local_date}
        />
        <StatCard
          label="Entries"
          value={String(entries.length)}
          sub="active measurement entries"
        />
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <div className="text-sm font-semibold">History</div>

        {entries.length === 0 ? (
          <div className="mt-4 rounded-xl border p-4 text-sm text-muted-foreground">
            No measurement entries yet.
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {byDate.map(([date, rows]) => (
              <section key={date} className="rounded-xl border p-3">
                <div className="text-sm font-semibold">{date}</div>

                <div className="mt-3 space-y-2">
                  {rows.map((entry) => (
                    <div key={entry.measurement_entry_id} className="rounded-xl border p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{displayKind(entry.entry_kind)}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{entrySummary(entry)}</div>
                          {entry.source ? (
                            <div className="mt-1 text-xs text-muted-foreground">Source: {entry.source}</div>
                          ) : null}
                          {entry.notes ? (
                            <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{entry.notes}</div>
                          ) : null}

                          <details className="mt-3 rounded-lg border p-2">
                            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                              Open details
                            </summary>
                            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                              {detailRows(entry).map(([label, value]) => (
                                <div key={`${entry.measurement_entry_id}:${label}`} className="rounded-md border p-2">
                                  <div className="text-muted-foreground">{label}</div>
                                  <div className="mt-1 break-words font-medium">{value}</div>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>

                        <Link
                          href="/lifeswitch/measurements/capture"
                          className="rounded-md border px-2 py-1 text-xs hover:bg-muted/30"
                        >
                          Edit in Capture
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
