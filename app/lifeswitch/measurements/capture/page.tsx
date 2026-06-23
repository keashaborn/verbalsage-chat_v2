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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function jacksonPollock7MalePercent(sum7: number, age: number): number | null {
  if (!Number.isFinite(sum7) || !Number.isFinite(age) || sum7 <= 0 || age <= 0) return null;
  const density = 1.112 - 0.00043499 * sum7 + 0.00000055 * sum7 * sum7 - 0.00028826 * age;
  if (!Number.isFinite(density) || density <= 0) return null;
  return round1(495 / density - 450);
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  help?: string;
}) {
  return (
    <label className="text-sm">
      <div className="text-muted-foreground">{label}</div>
      {help ? <div className="mt-1 text-xs leading-snug text-muted-foreground">{help}</div> : null}
      <input
        className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder || ""}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <label className="text-sm">
      <div className="text-muted-foreground">{label}</div>
      {help ? <div className="mt-1 text-xs leading-snug text-muted-foreground">{help}</div> : null}
      <select
        className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      >
        {children}
      </select>
    </label>
  );
}

export default function MeasurementsCapturePage() {
  const [localDate, setLocalDate] = React.useState(todayLocalYYYYMMDD());
  const [entryKind, setEntryKind] = React.useState("weight");

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
  const [method, setMethod] = React.useState("manual");
  const [source, setSource] = React.useState("manual");
  const [notes, setNotes] = React.useState("");

  const [skinfoldAge, setSkinfoldAge] = React.useState("");
  const [sfChest, setSfChest] = React.useState("");
  const [sfAbdomen, setSfAbdomen] = React.useState("");
  const [sfThigh, setSfThigh] = React.useState("");
  const [sfTriceps, setSfTriceps] = React.useState("");
  const [sfSubscapular, setSfSubscapular] = React.useState("");
  const [sfSuprailiac, setSfSuprailiac] = React.useState("");
  const [sfMidaxillary, setSfMidaxillary] = React.useState("");

  const [entries, setEntries] = React.useState<MeasurementEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [flash, setFlash] = React.useState("");

  const skinfoldValues = [
    toNum(sfChest),
    toNum(sfAbdomen),
    toNum(sfThigh),
    toNum(sfTriceps),
    toNum(sfSubscapular),
    toNum(sfSuprailiac),
    toNum(sfMidaxillary),
  ];

  const skinfoldSum =
    skinfoldValues.every((v) => v != null)
      ? skinfoldValues.reduce((sum, v) => sum + Number(v || 0), 0)
      : null;

  const calculatedSkinfoldBodyFat =
    skinfoldSum != null ? jacksonPollock7MalePercent(skinfoldSum, Number(skinfoldAge)) : null;

  async function loadEntries() {
    setLoading(true);
    setStatus("");

    try {
      const rows = (await fetchJson("/api/lifeswitch/measurements/entries?limit=12")) as MeasurementEntry[];
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

  function buildPayload() {
    const base: any = {
      local_date: localDate,
      entry_kind: entryKind,
      source,
      measurement_unit: "in",
      notes,
    };

    if (entryKind === "weight") {
      return {
        ...base,
        weight_value: toNum(weight),
        weight_unit: "lb",
      };
    }

    if (entryKind === "tape") {
      return {
        ...base,
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
      };
    }

    if (entryKind === "body_fat_estimate") {
      return {
        ...base,
        body_fat_percent: toNum(bodyFat),
        body_fat_method: method,
      };
    }

    if (entryKind === "skinfolds") {
      return {
        ...base,
        body_fat_percent: calculatedSkinfoldBodyFat,
        body_fat_method: "jackson_pollock_7_site_male",
        source: source || "manual",
        skinfolds_json: {
          caliper: source,
          formula: "jackson_pollock_7_site_male",
          age: toNum(skinfoldAge),
          unit: "mm",
          sites: {
            chest: toNum(sfChest),
            abdomen: toNum(sfAbdomen),
            thigh: toNum(sfThigh),
            triceps: toNum(sfTriceps),
            subscapular: toNum(sfSubscapular),
            suprailiac: toNum(sfSuprailiac),
            midaxillary: toNum(sfMidaxillary),
          },
          sum7: skinfoldSum,
        },
      };
    }

    if (entryKind === "scan") {
      return {
        ...base,
        weight_value: toNum(weight),
        weight_unit: "lb",
        body_fat_percent: toNum(bodyFat),
        body_fat_method: method,
        scan_json: {
          scan_type: method,
          source,
          notes,
        },
      };
    }

    return {
      ...base,
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
    };
  }

  function hasUsefulData(payload: any) {
    const keys = [
      "weight_value",
      "waist_value",
      "abdomen_value",
      "neck_value",
      "chest_value",
      "hip_value",
      "left_arm_value",
      "right_arm_value",
      "left_thigh_value",
      "right_thigh_value",
      "left_calf_value",
      "right_calf_value",
      "body_fat_percent",
    ];

    return keys.some((k) => payload[k] != null) || Boolean(payload.skinfolds_json || payload.scan_json);
  }

  async function saveEntry() {
    setSaving(true);
    setStatus("");
    setFlash("");

    try {
      const payload = buildPayload();

      if (!hasUsefulData(payload)) {
        throw new Error("Enter at least one measurement before saving.");
      }

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

  function clearForm() {
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
    setNotes("");
    setSkinfoldAge("");
    setSfChest("");
    setSfAbdomen("");
    setSfThigh("");
    setSfTriceps("");
    setSfSubscapular("");
    setSfSuprailiac("");
    setSfMidaxillary("");
    setFlash("");
    setStatus("");
  }

  const latest = entries[0] || null;

  return (
    <div className="mx-auto max-w-5xl p-4 pb-28">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Measurements · Capture</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log weight, tape, skinfolds, body-fat estimates, and scan results as separate measurement events.
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
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField label="Entry type" value={entryKind} onChange={setEntryKind}>
              <option value="weight">Weight</option>
              <option value="tape">Tape measurements</option>
              <option value="body_fat_estimate">Body-fat estimate</option>
              <option value="skinfolds">Skinfolds / calipers</option>
              <option value="scan">Scan: DEXA / InBody</option>
              <option value="general">General mixed entry</option>
            </SelectField>

            <SelectField label="Source" value={source} onChange={setSource}>
              <option value="manual">Manual</option>
              <option value="home_scale">Home scale</option>
              <option value="withings">Withings</option>
              <option value="apple_health">Apple Health</option>
              <option value="renpho_tape">Renpho tape</option>
              <option value="harpenden">Harpenden caliper</option>
              <option value="dexa">DEXA</option>
              <option value="inbody">InBody</option>
              <option value="other">Other</option>
            </SelectField>

            {["body_fat_estimate", "scan"].includes(entryKind) ? (
              <SelectField label="Method" value={method} onChange={setMethod}>
                <option value="manual">Manual estimate</option>
                <option value="scale">Scale / BIA</option>
                <option value="navy_tape">Navy tape</option>
                <option value="calipers">Calipers</option>
                <option value="dexa">DEXA</option>
                <option value="inbody">InBody</option>
                <option value="three_d_scan">3D scan</option>
              </SelectField>
            ) : null}
          </div>

          {entryKind === "weight" ? (
            <section className="mt-6 rounded-xl border p-4">
              <div className="text-sm font-semibold">Weight entry</div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Best practice: weigh at a consistent time, ideally morning after bathroom and before food or drink.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Weight (lb)" value={weight} onChange={setWeight} placeholder="167.0" />
              </div>
            </section>
          ) : null}

          {entryKind === "tape" ? (
            <section className="mt-6 rounded-xl border p-4">
              <div className="text-sm font-semibold">Tape measurements</div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Use the same tape, same posture, same anatomical locations, and similar time of day. Keep the tape flat and snug, but do not compress tissue.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
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
            </section>
          ) : null}

          {entryKind === "body_fat_estimate" ? (
            <section className="mt-6 rounded-xl border p-4">
              <div className="text-sm font-semibold">Body-fat estimate</div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Use this for a visual estimate, scale estimate, Navy tape result, or externally calculated percentage.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Body fat %" value={bodyFat} onChange={setBodyFat} placeholder="15.5" />
              </div>
            </section>
          ) : null}

          {entryKind === "skinfolds" ? (
            <section className="mt-6 rounded-xl border p-4">
              <div className="text-sm font-semibold">Skinfolds / calipers</div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Harpenden/Jackson-Pollock 7-site entry. Take each site consistently. A good default is 2–3 readings per site and use the average or median.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Age" value={skinfoldAge} onChange={setSkinfoldAge} placeholder="62" />
                <div className="rounded-xl border p-3 text-sm">
                  <div className="text-muted-foreground">7-site sum</div>
                  <div className="mt-1 text-lg font-semibold">{skinfoldSum != null ? `${round1(skinfoldSum)} mm` : "—"}</div>
                </div>
                <div className="rounded-xl border p-3 text-sm">
                  <div className="text-muted-foreground">Calculated body fat</div>
                  <div className="mt-1 text-lg font-semibold">{calculatedSkinfoldBodyFat != null ? `${calculatedSkinfoldBodyFat}%` : "—"}</div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field
                  label="Chest skinfold (mm)"
                  value={sfChest}
                  onChange={setSfChest}
                  help="Diagonal fold halfway between the front armpit line and nipple."
                />
                <Field
                  label="Abdomen skinfold (mm)"
                  value={sfAbdomen}
                  onChange={setSfAbdomen}
                  help="Vertical fold about 1 inch to the side of the navel."
                />
                <Field
                  label="Thigh skinfold (mm)"
                  value={sfThigh}
                  onChange={setSfThigh}
                  help="Vertical fold on the front midline of the thigh, halfway between hip crease and kneecap."
                />
                <Field
                  label="Triceps skinfold (mm)"
                  value={sfTriceps}
                  onChange={setSfTriceps}
                  help="Vertical fold on the back of the upper arm, halfway between shoulder and elbow."
                />
                <Field
                  label="Subscapular skinfold (mm)"
                  value={sfSubscapular}
                  onChange={setSfSubscapular}
                  help="Diagonal fold just below the lower angle of the shoulder blade."
                />
                <Field
                  label="Suprailiac skinfold (mm)"
                  value={sfSuprailiac}
                  onChange={setSfSuprailiac}
                  help="Diagonal fold just above the hip bone along the natural crease."
                />
                <Field
                  label="Midaxillary skinfold (mm)"
                  value={sfMidaxillary}
                  onChange={setSfMidaxillary}
                  help="Vertical fold on the side of the torso at the level of the sternum/xiphoid."
                />
              </div>
            </section>
          ) : null}

          {entryKind === "scan" ? (
            <section className="mt-6 rounded-xl border p-4">
              <div className="text-sm font-semibold">Scan result</div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Use this for DEXA, InBody, 3D scan, BodPod, or other external body-composition reports.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Weight (lb)" value={weight} onChange={setWeight} />
                <Field label="Body fat %" value={bodyFat} onChange={setBodyFat} />
              </div>
            </section>
          ) : null}

          {entryKind === "general" ? (
            <section className="mt-6 rounded-xl border p-4">
              <div className="text-sm font-semibold">General mixed entry</div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Use this only when you intentionally want to save several measurement types together.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Weight (lb)" value={weight} onChange={setWeight} placeholder="167.0" />
                <Field label="Waist (in)" value={waist} onChange={setWaist} placeholder="36.0" />
                <Field label="Abdomen (in)" value={abdomen} onChange={setAbdomen} placeholder="36.2" />
                <Field label="Neck (in)" value={neck} onChange={setNeck} placeholder="15.75" />
                <Field label="Chest (in)" value={chest} onChange={setChest} placeholder="41.0" />
                <Field label="Hip (in)" value={hip} onChange={setHip} placeholder="38.0" />
                <Field label="Body fat %" value={bodyFat} onChange={setBodyFat} placeholder="15.5" />
              </div>
            </section>
          ) : null}

          <label className="mt-6 block text-sm">
            <div className="text-muted-foreground">Notes</div>
            <textarea
              className="mt-1 min-h-28 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              placeholder="Measurement context: time of day, after bathroom, hydration, sodium, workout soreness, device/facility, caliper notes, etc."
            />
          </label>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
              onClick={() => void saveEntry()}
              disabled={saving}
            >
              {saving ? "Saving..." : `Save ${entryKind.replaceAll("_", " ")} entry`}
            </button>

            <button
              type="button"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-muted/30"
              onClick={clearForm}
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
                {latest.entry_kind ? <div>Type: {latest.entry_kind}</div> : null}
                {latest.weight_value != null ? <div>Weight: {latest.weight_value} {latest.weight_unit || "lb"}</div> : null}
                {latest.waist_value != null ? <div>Waist: {latest.waist_value} {latest.measurement_unit || "in"}</div> : null}
                {latest.body_fat_percent != null ? <div>Body fat: {latest.body_fat_percent}%</div> : null}
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
