"use client";

import * as React from "react";
import { MiniLineChart, type XYPoint } from "@/components/sslg/MiniLineChart";
import { authFetch } from "@/lib/authFetch";

export const dynamic = "force-dynamic";

type MeasurementEntry = {
  measurement_entry_id: string;
  local_date: string;
  weight_value?: number | null;
  weight_unit?: string | null;
  waist_value?: number | null;
  abdomen_value?: number | null;
  body_fat_percent?: number | null;
  entry_kind?: string | null;
  source?: string | null;
  created_at?: string | null;
};

async function fetchJson(url: string, init?: RequestInit) {
  const res = await authFetch(url, { ...init, cache: "no-store" });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const detail = typeof data === "object" && data ? data.detail || data.error : text;
    throw new Error(String(detail || `HTTP ${res.status}`));
  }

  return data;
}

function latestOf(entries: MeasurementEntry[], kind: string) {
  return entries.find((e) => e.entry_kind === kind) || null;
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function metricSeries(entries: MeasurementEntry[], key: keyof MeasurementEntry): XYPoint[] {
  const points: XYPoint[] = [];

  for (const e of entries) {
    const y = coerceNumber(e[key]);
    const x = String(e.local_date || e.created_at || "").slice(0, 10);

    if (!x || y == null) continue;

    points.push({
      x,
      y,
      id: e.measurement_entry_id,
      occurred_at: e.created_at || e.local_date,
      sort_ts: e.local_date || e.created_at || x,
      data: e,
    });
  }

  return points.sort((a, b) => String(a.sort_ts || a.x).localeCompare(String(b.sort_ts || b.x)));
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

export default function MeasurementsAnalyzePage() {
  const [entries, setEntries] = React.useState<MeasurementEntry[]>([]);
  const [status, setStatus] = React.useState("");

  React.useEffect(() => {
    (async () => {
      try {
        const rows = (await fetchJson("/api/lifeswitch/measurements/entries?limit=250")) as MeasurementEntry[];
        setEntries(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        setStatus(String(e?.message || e));
        setEntries([]);
      }
    })();
  }, []);

  const latestWeight = latestOf(entries, "weight");
  const latestTape = latestOf(entries, "tape");
  const latestSkinfolds = latestOf(entries, "skinfolds");
  const latestScan = latestOf(entries, "scan");

  const bf =
    latestSkinfolds?.body_fat_percent ??
    latestScan?.body_fat_percent ??
    latestWeight?.body_fat_percent ??
    null;

  const weight = latestWeight?.weight_value ?? latestScan?.weight_value ?? null;
  const fatMass = weight != null && bf != null ? Math.round(weight * (bf / 100) * 10) / 10 : null;
  const leanMass = weight != null && bf != null ? Math.round((weight - weight * (bf / 100)) * 10) / 10 : null;

  const weightSeries = React.useMemo(() => metricSeries(entries, "weight_value"), [entries]);
  const waistSeries = React.useMemo(() => metricSeries(entries, "waist_value"), [entries]);
  const bodyFatSeries = React.useMemo(() => metricSeries(entries, "body_fat_percent"), [entries]);

  return (
    <div className="mx-auto max-w-5xl p-4 pb-28">
      <h1 className="text-xl font-semibold">Measurements · Analyze</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Current body-state read from weight, tape, skinfold, and scan entries.
      </p>

      {status ? <div className="mt-4 text-sm text-red-600">{status}</div> : null}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard
          label="Weight"
          value={weight != null ? `${weight} lb` : "—"}
          sub={latestWeight?.local_date || latestScan?.local_date}
        />
        <StatCard
          label="Waist"
          value={latestTape?.waist_value != null ? `${latestTape.waist_value} in` : "—"}
          sub={latestTape?.local_date}
        />
        <StatCard
          label="Body fat"
          value={bf != null ? `${bf}%` : "—"}
          sub={latestSkinfolds?.local_date || latestScan?.local_date || latestWeight?.local_date}
        />
        <StatCard
          label="Entries"
          value={String(entries.length)}
          sub="active records"
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <StatCard
          label="Estimated fat mass"
          value={fatMass != null ? `${fatMass} lb` : "—"}
          sub="requires weight + body-fat estimate"
        />
        <StatCard
          label="Estimated lean mass"
          value={leanMass != null ? `${leanMass} lb` : "—"}
          sub="derived from current estimate"
        />
      </div>

      <section className="mt-6 grid gap-4">
        <div>
          <div className="text-sm font-semibold">Measurement trends</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Single-subject line graphs from measurement entries. Phase-change markers will be added from Plan history later.
          </p>
        </div>

        <MiniLineChart
          title="Weight over time"
          series={weightSeries}
          xMode="date"
          yLabel="Weight"
          ySuffix=" lb"
          includeZero={false}
          heightPx={260}
        />

        <MiniLineChart
          title="Waist over time"
          series={waistSeries}
          xMode="date"
          yLabel="Waist"
          ySuffix=" in"
          includeZero={false}
          heightPx={260}
        />

        <MiniLineChart
          title="Body-fat estimate over time"
          series={bodyFatSeries}
          xMode="date"
          yLabel="Body fat"
          ySuffix="%"
          includeZero={false}
          heightPx={260}
        />
      </section>
    </div>
  );
}
