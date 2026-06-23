"use client";

import * as React from "react";
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
  created_at?: string | null;
  updated_at?: string | null;
};

function todayLocalYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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

function toNum(v: string): number | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="text-sm">
      <div className="text-muted-foreground">{label}</div>
      <input
        className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder || ""}
      />
    </label>
  );
}

export default function MeasurementsCapturePage() {
  const [localDate, setLocalDate] = React.useState(todayLocalYYYYMMDD());

  const [weight, setWeight] = React.useState("");
  const [waist, setWaist] = React.useState("");
  const [abdomen, setAbdomen] = React.useState("");
  const [neck, setNeck] = React.useState("");
  const [chest, setChest] = React.useState("");
  const [hip, setHip] = React.useState("");

  const [leftArm, setLeftArm] = React.useState("");
  const [rightArm, setRightArm] = React.useState("");
  const [leftThigh, setLeftThigh] = React.useState("");
  const [rightThigh, setRightThigh] = React.useState("");
  const [leftCalf, setLeftCalf] = React.useState("");
  const [rightCalf, setRightCalf] = React.useState("");

  const [bodyFat, setBodyFat] = React.useState("");
  const [entryKind, setEntryKind] = React.useState("weight");
  const [method, setMethod] = React.useState("manual");
  const [source, setSource] = React.useState("manual");
  const [notes, setNotes] = React.useState("");

  const [entries, setEntries] = React.useState<MeasurementEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [flash, setFlash] = React.useState("");

  async function loadEntries() {
    setLoading(true);
    setStatus("");

    try {
      const rows = (await fetchJson("/api/lifeswitch/measurements/entries?limit=10")) as MeasurementEntry[];
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

  async function saveEntry() {
    setSaving(true);
    setStatus("");
    setFlash("");

    try {
      const payload = {
        local_date: localDate,

        weight_value: toNum(weight),
        weight_unit: "lb",

        waist_value: toNum(waist),
        abdomen_value: toNum(abdomen),
        neck_value: toNum(neck),
        chest_value: toNum(chest),
        hip_value: toNum(hip),

        left_arm_value: toNum(leftArm),
        right_arm_value: toNum(rightArm),
        left_thigh_value: toNum(leftThigh),
        right_thigh_value: toNum(rightThigh),
        left_calf_value: toNum(leftCalf),
        right_calf_value: toNum(rightCalf),

        body_fat_percent: toNum(bodyFat),
        body_fat_method: method,
        entry_kind: entryKind,
        measurement_unit: "in",
        source,
        notes,
      };

      await fetchJson("/api/lifeswitch/measurements/entries/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      setFlash("Measurement entry saved.");
      await loadEntries();
    } catch (e: any) {
      setStatus(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  const latest = entries[0] || null;

  return (
    <div className="mx-auto max-w-5xl p-4 pb-28">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Measurements · Capture</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log body measurements manually. Device imports can feed this same log later.
          </p>
        </div>

        <input
          type="date"
          value={localDate}
          onChange={(e) => setLocalDate(e.currentTarget.value)}
          className="rounded-xl border bg-background px-3 py-2 text-sm"
        />
      </div>

      {flash ? <div className="mt-4 text-sm text-green-600">{flash}</div> : null}
      {status ? <div className="mt-4 text-sm text-red-600">{status}</div> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <main className="rounded-xl border p-4">
          <div className="text-sm font-semibold">Body measurements</div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="Weight (lb)" value={weight} onChange={setWeight} placeholder="167.0" />
            <Field label="Waist (in)" value={waist} onChange={setWaist} placeholder="36.0" />
            <Field label="Abdomen (in)" value={abdomen} onChange={setAbdomen} placeholder="36.2" />
            <Field label="Neck (in)" value={neck} onChange={setNeck} placeholder="15.75" />
            <Field label="Chest (in)" value={chest} onChange={setChest} placeholder="41.0" />
            <Field label="Hip (in)" value={hip} onChange={setHip} placeholder="38.0" />
          </div>

          <div className="mt-6 text-sm font-semibold">Limbs</div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="Left arm (in)" value={leftArm} onChange={setLeftArm} />
            <Field label="Right arm (in)" value={rightArm} onChange={setRightArm} />
            <Field label="Left thigh (in)" value={leftThigh} onChange={setLeftThigh} />
            <Field label="Right thigh (in)" value={rightThigh} onChange={setRightThigh} />
            <Field label="Left calf (in)" value={leftCalf} onChange={setLeftCalf} />
            <Field label="Right calf (in)" value={rightCalf} onChange={setRightCalf} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="text-sm">
              <div className="text-muted-foreground">Entry type</div>
              <select
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={entryKind}
                onChange={(e) => setEntryKind(e.currentTarget.value)}
              >
                <option value="weight">Weight</option>
                <option value="tape">Tape measurements</option>
                <option value="body_fat_estimate">Body-fat estimate</option>
                <option value="skinfolds">Skinfolds / calipers</option>
                <option value="scan">Scan: DEXA / InBody</option>
                <option value="general">General mixed entry</option>
              </select>
            </label>

            <Field label="Body fat %" value={bodyFat} onChange={setBodyFat} placeholder="15.5" />

            <label className="text-sm">
              <div className="text-muted-foreground">Method</div>
              <select
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={method}
                onChange={(e) => setMethod(e.currentTarget.value)}
              >
                <option value="manual">Manual estimate</option>
                <option value="scale">Scale / BIA</option>
                <option value="navy_tape">Navy tape</option>
                <option value="calipers">Calipers</option>
                <option value="dexa">DEXA</option>
                <option value="inbody">InBody</option>
              </select>
            </label>

            <label className="text-sm">
              <div className="text-muted-foreground">Source</div>
              <select
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={source}
                onChange={(e) => setSource(e.currentTarget.value)}
              >
                <option value="manual">Manual</option>
                <option value="scale">Scale</option>
                <option value="apple_health">Apple Health</option>
                <option value="withings">Withings</option>
                <option value="dexa">DEXA</option>
                <option value="inbody">InBody</option>
              </select>
            </label>
          </div>

          <label className="mt-6 block text-sm">
            <div className="text-muted-foreground">Notes</div>
            <textarea
              className="mt-1 min-h-28 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              placeholder="Measurement context, time of day, hydration, sodium, training soreness, caliper notes, etc."
            />
          </label>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
              onClick={() => void saveEntry()}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save measurement entry"}
            </button>

            <button
              type="button"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-muted/30"
              onClick={() => {
                setWeight("");
                setWaist("");
                setAbdomen("");
                setNeck("");
                setChest("");
                setHip("");
                setLeftArm("");
                setRightArm("");
                setLeftThigh("");
                setRightThigh("");
                setLeftCalf("");
                setRightCalf("");
                setBodyFat("");
                setEntryKind("weight");
                setNotes("");
                setFlash("");
                setStatus("");
              }}
            >
              Clear form
            </button>
          </div>
        </main>

        <aside className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Latest entries</div>
            <button
              type="button"
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted/30"
              onClick={() => void loadEntries()}
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {latest ? (
            <div className="mt-4 rounded-xl border p-3 text-sm">
              <div className="font-medium">{latest.local_date}</div>
              <div className="mt-2 space-y-1 text-muted-foreground">
                {latest.weight_value != null ? <div>Weight: {latest.weight_value} {latest.weight_unit || "lb"}</div> : null}
                {latest.waist_value != null ? <div>Waist: {latest.waist_value} {latest.measurement_unit || "in"}</div> : null}
                {latest.body_fat_percent != null ? <div>Body fat: {latest.body_fat_percent}%</div> : null}
                <div>Type: {latest.entry_kind || "general"}</div>
                <div>Source: {latest.source || "manual"}</div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border p-3 text-sm text-muted-foreground">
              No measurement entries yet.
            </div>
          )}

          <div className="mt-4 space-y-2">
            {entries.slice(0, 8).map((entry) => (
              <div key={entry.measurement_entry_id} className="rounded-xl border p-3 text-xs">
                <div className="font-medium">{entry.local_date}</div>
                <div className="mt-1 text-muted-foreground">
                  {entry.entry_kind || "general"} · {entry.weight_value != null ? `${entry.weight_value} ${entry.weight_unit || "lb"}` : "No weight"}
                  {entry.waist_value != null ? ` · waist ${entry.waist_value}` : ""}
                  {entry.body_fat_percent != null ? ` · BF ${entry.body_fat_percent}%` : ""}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
