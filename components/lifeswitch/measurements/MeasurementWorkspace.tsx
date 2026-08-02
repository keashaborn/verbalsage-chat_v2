"use client";

import * as React from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import {
  MeasurementDateChart,
  type MeasurementDatePoint,
} from "@/components/lifeswitch/measurements/MeasurementDateChart";

export const dynamic = "force-dynamic";

type ProgressMetric = "weight" | "waist" | "body_fat";

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
  skinfolds_json?: unknown;
  scan_json?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

type ComparableSeries = {
  points: MeasurementDatePoint[];
  methodLabel: string;
  unit: string;
};

async function fetchJson(url: string, init?: RequestInit) {
  const response = await authFetch(url, { ...init, cache: "no-store" });
  const text = await response.text();
  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const detail =
      typeof data === "object" && data
        ? (data as { detail?: unknown; error?: unknown }).detail ||
          (data as { detail?: unknown; error?: unknown }).error
        : text;
    throw new Error(String(detail || `HTTP ${response.status}`));
  }

  return data;
}

function objectJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function recencyKey(entry: MeasurementEntry): string {
  return `${entry.local_date || ""}|${entry.updated_at || entry.created_at || ""}`;
}

function newestEntry(entries: MeasurementEntry[]): MeasurementEntry | null {
  return (
    [...entries].sort((a, b) =>
      recencyKey(b).localeCompare(recencyKey(a)),
    )[0] || null
  );
}

function humanize(value?: string | null): string {
  if (!value) return "Not specified";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateNumber(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return 0;
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year || 1970, Math.max(0, (month || 1) - 1), day || 1);
}

function longDate(date?: string | null): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(dateNumber(date)));
}

function numberLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function displayKind(kind?: string | null): string {
  if (kind === "weight") return "Weight";
  if (kind === "tape") return "Tape measurements";
  if (kind === "skinfolds") return "Skinfold assessment";
  if (kind === "scan") return "Body scan";
  return humanize(kind || "measurement");
}

function entrySummary(entry: MeasurementEntry): string {
  const parts: string[] = [];
  const unit = entry.measurement_unit || "in";
  const skinfolds = objectJson(entry.skinfolds_json);
  const scan = objectJson(entry.scan_json);

  if (entry.weight_value != null) {
    parts.push(
      `${numberLabel(Number(entry.weight_value))} ${entry.weight_unit || "lb"}`,
    );
  }
  if (entry.waist_value != null)
    parts.push(`waist ${numberLabel(Number(entry.waist_value))} ${unit}`);
  if (entry.abdomen_value != null)
    parts.push(`abdomen ${numberLabel(Number(entry.abdomen_value))} ${unit}`);
  if (entry.chest_value != null)
    parts.push(`chest ${numberLabel(Number(entry.chest_value))} ${unit}`);
  if (entry.hip_value != null)
    parts.push(`hip ${numberLabel(Number(entry.hip_value))} ${unit}`);
  if (entry.body_fat_percent != null) {
    parts.push(`body fat ${numberLabel(Number(entry.body_fat_percent))}%`);
  }
  if (entry.entry_kind === "skinfolds" && numberValue(skinfolds.sum7) != null) {
    parts.push(`7-site sum ${numberLabel(Number(skinfolds.sum7))} mm`);
  }
  if (entry.entry_kind === "scan" && numberValue(scan.lean_mass_lb) != null) {
    parts.push(`lean mass ${numberLabel(Number(scan.lean_mass_lb))} lb`);
  }

  return parts.length ? parts.join(" · ") : "No values available";
}

function detailRows(entry: MeasurementEntry): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const unit = entry.measurement_unit || "in";
  const skinfolds = objectJson(entry.skinfolds_json);
  const sites = objectJson(skinfolds.sites);
  const scan = objectJson(entry.scan_json);

  const push = (label: string, value: unknown, suffix = "") => {
    if (value == null || value === "") return;
    rows.push([label, `${value}${suffix}`]);
  };

  push("Source", entry.source ? humanize(entry.source) : null);
  push("Weight", entry.weight_value, ` ${entry.weight_unit || "lb"}`);
  push("Body fat", entry.body_fat_percent, "%");
  push(
    "Body-fat method",
    entry.body_fat_method ? humanize(entry.body_fat_method) : null,
  );
  push("Waist", entry.waist_value, ` ${unit}`);
  push("Abdomen", entry.abdomen_value, ` ${unit}`);
  push("Neck", entry.neck_value, ` ${unit}`);
  push("Chest", entry.chest_value, ` ${unit}`);
  push("Hip", entry.hip_value, ` ${unit}`);
  push("Left arm", entry.left_arm_value, ` ${unit}`);
  push("Right arm", entry.right_arm_value, ` ${unit}`);
  push("Left thigh", entry.left_thigh_value, ` ${unit}`);
  push("Right thigh", entry.right_thigh_value, ` ${unit}`);
  push("Left calf", entry.left_calf_value, ` ${unit}`);
  push("Right calf", entry.right_calf_value, ` ${unit}`);
  push(
    "Skinfold protocol",
    skinfolds.protocol ? humanize(String(skinfolds.protocol)) : null,
  );
  push("Skinfold sum", skinfolds.sum7, " mm");
  push("Chest skinfold", sites.chest, " mm");
  push("Abdomen skinfold", sites.abdomen, " mm");
  push("Thigh skinfold", sites.thigh, " mm");
  push("Triceps skinfold", sites.triceps, " mm");
  push("Subscapular skinfold", sites.subscapular, " mm");
  push("Suprailiac skinfold", sites.suprailiac, " mm");
  push("Midaxillary skinfold", sites.midaxillary, " mm");
  push("Scan type", scan.scan_type ? humanize(String(scan.scan_type)) : null);
  push("Facility / device", scan.facility_or_device);
  push("Fat mass", scan.fat_mass_lb, " lb");
  push("Lean mass", scan.lean_mass_lb, " lb");
  push("Bone mass / BMC", scan.bone_mass_lb, " lb");
  push("Visceral fat / VAT", scan.visceral_fat);
  push("Skeletal muscle mass", scan.skeletal_muscle_mass_lb, " lb");

  return rows;
}

function compatibleSeries(
  entries: MeasurementEntry[],
  metric: "weight" | "waist" | "body_fat",
): ComparableSeries {
  let candidates: MeasurementEntry[] = [];
  let valueFor: (entry: MeasurementEntry) => number | null;
  let keyFor: (entry: MeasurementEntry) => string;
  let labelFor: (entry: MeasurementEntry) => string;
  let unit = "";

  if (metric === "weight") {
    candidates = entries.filter(
      (entry) =>
        entry.entry_kind === "weight" &&
        numberValue(entry.weight_value) != null,
    );
    if (!candidates.length) {
      candidates = entries.filter(
        (entry) => numberValue(entry.weight_value) != null,
      );
    }
    valueFor = (entry) => numberValue(entry.weight_value);
    keyFor = (entry) =>
      `${entry.entry_kind || "unknown"}|${entry.source || "unknown"}|${entry.weight_unit || "lb"}`;
    labelFor = (entry) =>
      `${humanize(entry.source)} · ${entry.weight_unit || "lb"}`;
    unit = candidates[0]?.weight_unit || "lb";
  } else if (metric === "waist") {
    candidates = entries.filter(
      (entry) =>
        entry.entry_kind === "tape" && numberValue(entry.waist_value) != null,
    );
    if (!candidates.length) {
      candidates = entries.filter(
        (entry) => numberValue(entry.waist_value) != null,
      );
    }
    valueFor = (entry) => numberValue(entry.waist_value);
    keyFor = (entry) =>
      `${entry.entry_kind || "unknown"}|${entry.source || "unknown"}|${entry.measurement_unit || "in"}`;
    labelFor = (entry) =>
      `${humanize(entry.source)} · ${entry.measurement_unit || "in"}`;
    unit = candidates[0]?.measurement_unit || "in";
  } else {
    candidates = entries.filter(
      (entry) => numberValue(entry.body_fat_percent) != null,
    );
    valueFor = (entry) => numberValue(entry.body_fat_percent);
    keyFor = (entry) => {
      const skinfolds = objectJson(entry.skinfolds_json);
      const scan = objectJson(entry.scan_json);
      return [
        entry.body_fat_method || "unknown_method",
        entry.source || "unknown_source",
        skinfolds.protocol || "",
        scan.facility_or_device || "",
      ].join("|");
    };
    labelFor = (entry) =>
      humanize(entry.body_fat_method || entry.source || entry.entry_kind);
    unit = "%";
  }

  if (!candidates.length)
    return { points: [], methodLabel: "No comparable method", unit };

  const groups = new Map<string, MeasurementEntry[]>();
  for (const entry of candidates) {
    const key = keyFor(entry);
    const group = groups.get(key) || [];
    group.push(entry);
    groups.set(key, group);
  }

  const selected = Array.from(groups.values()).sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return recencyKey(newestEntry(b) || b[0]!).localeCompare(
      recencyKey(newestEntry(a) || a[0]!),
    );
  })[0];
  if (!selected)
    return { points: [], methodLabel: "No comparable method", unit };
  const latest = newestEntry(selected);
  if (!latest) return { points: [], methodLabel: "No comparable method", unit };

  if (metric === "weight") unit = latest.weight_unit || "lb";
  if (metric === "waist") unit = latest.measurement_unit || "in";

  const comparisonKey = keyFor(latest);
  const byDate = new Map<string, MeasurementEntry>();
  const compatible = selected
    .filter((entry) => keyFor(entry) === comparisonKey)
    .sort((a, b) => recencyKey(a).localeCompare(recencyKey(b)));

  for (const entry of compatible) {
    if (entry.local_date) byDate.set(entry.local_date, entry);
  }

  const points = Array.from(byDate.values())
    .map((entry) => ({
      id: entry.measurement_entry_id,
      date: entry.local_date,
      value: valueFor(entry),
    }))
    .filter((point): point is MeasurementDatePoint => point.value != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  return { points, methodLabel: labelFor(latest), unit };
}

function MetricCard({
  metric,
  label,
  value,
  date,
  method,
  active,
  onSelect,
}: {
  metric: ProgressMetric;
  label: string;
  value: string;
  date?: string | null;
  method?: string | null;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      id={`measurement-metric-${metric}`}
      type="button"
      aria-pressed={active}
      aria-controls="measurement-progress"
      className={`min-h-11 min-w-0 border-b-2 px-3 py-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset sm:px-5 ${
        active
          ? "border-foreground bg-muted/20"
          : "border-transparent hover:bg-muted/15"
      }`}
      onClick={onSelect}
    >
      <div className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1.5 text-xl font-semibold break-words sm:text-2xl">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">
        {date ? longDate(date) : "No observation"}
        {method ? ` · ${method}` : ""}
      </div>
    </button>
  );
}

function TrendCard({
  title,
  series,
}: {
  title: string;
  series: ComparableSeries;
}) {
  const points = series.points;

  return (
    <section className="border-t pt-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Comparable series: {series.methodLabel}
          </p>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {points.length} observation{points.length === 1 ? "" : "s"}
        </div>
      </div>

      {points.length === 0 ? (
        <div className="mt-4 border-y py-4 text-sm text-muted-foreground">
          No comparable observations have been recorded.
        </div>
      ) : points.length === 1 ? (
        <div className="mt-4 border-y py-4 text-sm text-muted-foreground">
          Baseline established on {longDate(points[0].date)}. Another
          observation using the same method is needed before a change can be
          calculated.
        </div>
      ) : (
        <>
          <div className="mt-4">
            <MeasurementDateChart
              points={points}
              unit={series.unit}
              label={title}
            />
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            Change:{" "}
            {points[points.length - 1].value - points[0].value > 0 ? "+" : ""}
            {numberLabel(
              points[points.length - 1].value - points[0].value,
            )}{" "}
            {series.unit} across{" "}
            {Math.round(
              (dateNumber(points[points.length - 1].date) -
                dateNumber(points[0].date)) /
                86_400_000,
            )}{" "}
            days.
          </div>
        </>
      )}
    </section>
  );
}

export function MeasurementWorkspace({
  targetUserId = "",
  targetName = "",
}: {
  targetUserId?: string;
  targetName?: string;
}) {
  const [entries, setEntries] = React.useState<MeasurementEntry[]>([]);
  const [selectedMetric, setSelectedMetric] =
    React.useState<ProgressMetric>("weight");
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState("");

  const loadEntries = React.useCallback(async () => {
    setLoading(true);
    setStatus("");

    try {
      const url = new URL(
        "/api/lifeswitch/measurements/entries",
        window.location.origin,
      );
      url.searchParams.set("limit", "250");
      if (targetUserId) url.searchParams.set("target_user_id", targetUserId);

      const rows = await fetchJson(url.toString());
      setEntries(Array.isArray(rows) ? (rows as MeasurementEntry[]) : []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  React.useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const sortedEntries = React.useMemo(
    () =>
      [...entries].sort((a, b) => recencyKey(b).localeCompare(recencyKey(a))),
    [entries],
  );

  const latestWeight = newestEntry(
    entries.filter((entry) => numberValue(entry.weight_value) != null),
  );
  const latestWaist = newestEntry(
    entries.filter((entry) => numberValue(entry.waist_value) != null),
  );
  const latestBodyFat = newestEntry(
    entries.filter((entry) => numberValue(entry.body_fat_percent) != null),
  );

  const byDate = React.useMemo(() => {
    const grouped = new Map<string, MeasurementEntry[]>();
    for (const entry of sortedEntries) {
      const date = entry.local_date || "undated";
      const rows = grouped.get(date) || [];
      rows.push(entry);
      grouped.set(date, rows);
    }
    return Array.from(grouped.entries());
  }, [sortedEntries]);

  const weightSeries = React.useMemo(
    () => compatibleSeries(entries, "weight"),
    [entries],
  );
  const waistSeries = React.useMemo(
    () => compatibleSeries(entries, "waist"),
    [entries],
  );
  const bodyFatSeries = React.useMemo(
    () => compatibleSeries(entries, "body_fat"),
    [entries],
  );
  const isDelegatedView = Boolean(targetUserId);
  const selectedSeries =
    selectedMetric === "weight"
      ? weightSeries
      : selectedMetric === "waist"
        ? waistSeries
        : bodyFatSeries;
  const selectedTitle =
    selectedMetric === "weight"
      ? "Weight"
      : selectedMetric === "waist"
        ? "Waist"
        : "Body fat";

  return (
    <div className="mx-auto max-w-5xl pb-8">
      {isDelegatedView ? (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          You are viewing {targetName || "this person"}’s measurements. This
          delegated view is read-only.
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">Measurements</h1>

        {!isDelegatedView ? (
          <Link
            href="/lifeswitch/measurements/capture"
            className="inline-flex min-h-11 items-center rounded-lg border border-border/60 px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
          >
            + Record
          </Link>
        ) : null}
      </div>

      {status ? (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center gap-2 border-y border-red-500/30 py-3 text-sm text-red-600"
        >
          <span>{status}</span>
          <button
            type="button"
            className="min-h-11 rounded-lg px-3 font-medium underline underline-offset-4"
            onClick={() => void loadEntries()}
          >
            Try again
          </button>
        </div>
      ) : null}

      <div
        className="mt-6 grid grid-cols-3 divide-x border-y"
        role="group"
        aria-label="Progress metric"
      >
        <MetricCard
          metric="weight"
          label="Weight"
          value={
            latestWeight?.weight_value != null
              ? `${numberLabel(Number(latestWeight.weight_value))} ${latestWeight.weight_unit || "lb"}`
              : "—"
          }
          date={latestWeight?.local_date}
          method={latestWeight ? humanize(latestWeight.source) : null}
          active={selectedMetric === "weight"}
          onSelect={() => setSelectedMetric("weight")}
        />
        <MetricCard
          metric="waist"
          label="Waist"
          value={
            latestWaist?.waist_value != null
              ? `${numberLabel(Number(latestWaist.waist_value))} ${latestWaist.measurement_unit || "in"}`
              : "—"
          }
          date={latestWaist?.local_date}
          method={latestWaist ? humanize(latestWaist.source) : null}
          active={selectedMetric === "waist"}
          onSelect={() => setSelectedMetric("waist")}
        />
        <MetricCard
          metric="body_fat"
          label="Body fat"
          value={
            latestBodyFat?.body_fat_percent != null
              ? `${numberLabel(Number(latestBodyFat.body_fat_percent))}%`
              : "—"
          }
          date={latestBodyFat?.local_date}
          method={
            latestBodyFat
              ? humanize(latestBodyFat.body_fat_method || latestBodyFat.source)
              : null
          }
          active={selectedMetric === "body_fat"}
          onSelect={() => setSelectedMetric("body_fat")}
        />
      </div>

      {loading ? (
        <div className="mt-6 border-y py-5 text-sm text-muted-foreground">
          Loading measurements…
        </div>
      ) : (
        <>
          <div
            id="measurement-progress"
            role="region"
            aria-labelledby={`measurement-metric-${selectedMetric}`}
            className="mt-6"
          >
            <TrendCard title={selectedTitle} series={selectedSeries} />
          </div>

          <section
            className="mt-8"
            aria-labelledby="measurement-history-heading"
          >
            <div className="flex items-center justify-between gap-3 border-b pb-3">
              <h2
                id="measurement-history-heading"
                className="text-base font-semibold"
              >
                History
              </h2>
              <div className="text-xs text-muted-foreground">
                {byDate.length} check-in{byDate.length === 1 ? "" : "s"}
              </div>
            </div>

            {byDate.length === 0 ? (
              <div className="border-b py-5 text-sm text-muted-foreground">
                No measurements have been recorded.
              </div>
            ) : (
              <div>
                {byDate.map(([date, rows]) => (
                  <section key={date} className="border-b py-1">
                    <div className="flex items-center justify-between gap-3 px-1 py-3">
                      <h3 className="text-sm font-semibold">
                        {longDate(date)}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {rows.length} observation{rows.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="divide-y">
                      {rows.map((entry) => {
                        const details = detailRows(entry);
                        return (
                          <div
                            key={entry.measurement_entry_id}
                            className="px-1 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-medium">
                                  {displayKind(entry.entry_kind)}
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {entrySummary(entry)}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {humanize(entry.source)}
                              </div>
                            </div>

                            {entry.notes ? (
                              <div className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">
                                {entry.notes}
                              </div>
                            ) : null}

                            {details.length ? (
                              <details className="mt-3">
                                <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-muted-foreground hover:text-foreground">
                                  Details
                                </summary>
                                <dl className="mt-3 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
                                  {details.map(([label, value]) => (
                                    <div
                                      key={`${entry.measurement_entry_id}:${label}`}
                                      className="grid grid-cols-2 gap-3"
                                    >
                                      <dt className="text-muted-foreground">
                                        {label}
                                      </dt>
                                      <dd className="font-medium break-words">
                                        {value}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                              </details>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
