"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";
import { selectNumberInputValue } from "@/components/lifeswitch/selectInputValue";

export const dynamic = "force-dynamic";

type EntryKind = "weight" | "tape" | "skinfolds" | "scan";

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

function valueText(v: unknown): string {
  return v == null ? "" : String(v);
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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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
    const sum7 = entry.skinfolds_json?.sum7;
    if (sum7 != null) parts.push(`sum ${Math.round(Number(sum7) * 10) / 10} mm`);
    return parts.length ? parts.join(" · ") : "Skinfold entry";
  }

  if (kind === "scan") {
    if (entry.weight_value != null) parts.push(`${entry.weight_value} ${entry.weight_unit || "lb"}`);
    if (entry.body_fat_percent != null) parts.push(`BF ${entry.body_fat_percent}%`);
    if (entry.scan_json?.fat_mass_lb != null) parts.push(`fat mass ${entry.scan_json.fat_mass_lb} lb`);
    if (entry.scan_json?.lean_mass_lb != null) parts.push(`lean mass ${entry.scan_json.lean_mass_lb} lb`);
    return parts.length ? parts.join(" · ") : "Scan entry";
  }

  if (entry.weight_value != null) parts.push(`${entry.weight_value} ${entry.weight_unit || "lb"}`);
  if (entry.waist_value != null) parts.push(`waist ${entry.waist_value}`);
  if (entry.body_fat_percent != null) parts.push(`BF ${entry.body_fat_percent}%`);
  return parts.length ? parts.join(" · ") : "Measurement entry";
}

function jacksonPollock7Percent(sum7: number, age: number, sex: "male" | "female"): number | null {
  if (!Number.isFinite(sum7) || !Number.isFinite(age) || sum7 <= 0 || age <= 0) return null;

  const density =
    sex === "female"
      ? 1.097 - 0.00046971 * sum7 + 0.00000056 * sum7 * sum7 - 0.00012828 * age
      : 1.112 - 0.00043499 * sum7 + 0.00000055 * sum7 * sum7 - 0.00028826 * age;

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
        onFocus={selectNumberInputValue}
        onClick={selectNumberInputValue}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder || ""}
      />
    </label>
  );
}

function TextField({
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
  const [entryKind, setEntryKind] = React.useState<EntryKind>("weight");

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
  const [source, setSource] = React.useState("home_scale");
  const [fitNote, setFitNote] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [skinfoldAge, setSkinfoldAge] = React.useState("");
  const [skinfoldSex, setSkinfoldSex] = React.useState<"male" | "female">("male");
  const [sfChest, setSfChest] = React.useState("");
  const [sfAbdomen, setSfAbdomen] = React.useState("");
  const [sfThigh, setSfThigh] = React.useState("");
  const [sfTriceps, setSfTriceps] = React.useState("");
  const [sfSubscapular, setSfSubscapular] = React.useState("");
  const [sfSuprailiac, setSfSuprailiac] = React.useState("");
  const [sfMidaxillary, setSfMidaxillary] = React.useState("");

  const [scanFacility, setScanFacility] = React.useState("");
  const [scanFatMass, setScanFatMass] = React.useState("");
  const [scanLeanMass, setScanLeanMass] = React.useState("");
  const [scanBoneMass, setScanBoneMass] = React.useState("");
  const [scanVisceral, setScanVisceral] = React.useState("");
  const [scanSkeletalMuscle, setScanSkeletalMuscle] = React.useState("");

  const [entries, setEntries] = React.useState<MeasurementEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
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
    skinfoldSum != null ? jacksonPollock7Percent(skinfoldSum, Number(skinfoldAge), skinfoldSex) : null;

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

  function setEntryKindWithDefaults(next: EntryKind) {
    setEntryKind(next);

    if (next === "weight") setSource("home_scale");
    if (next === "tape") setSource("self_tape");
    if (next === "skinfolds") setSource("harpenden");
    if (next === "scan") setSource("dexa");

    setFlash("");
    setStatus("");
  }

  function composedNotes() {
    const parts = [];
    if (fitNote) parts.push(`Fit/appearance: ${fitNote}.`);
    if (notes.trim()) parts.push(notes.trim());
    return parts.join("\n");
  }

  function buildPayload() {
    const base: any = {
      local_date: localDate,
      entry_kind: entryKind,
      source,
      measurement_unit: "in",
      notes: composedNotes(),
    };

    if (entryKind === "weight") {
      return {
        ...base,
        weight_value: toNum(weight),
        weight_unit: "lb",
        body_fat_percent: toNum(bodyFat),
        body_fat_method: toNum(bodyFat) != null ? "scale_bia" : null,
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

    if (entryKind === "skinfolds") {
      return {
        ...base,
        body_fat_percent: calculatedSkinfoldBodyFat,
        body_fat_method: `jackson_pollock_7_site_${skinfoldSex}`,
        skinfolds_json: {
          caliper: source,
          protocol: `jackson_pollock_7_site_${skinfoldSex}`,
          formula: `jackson_pollock_7_site_${skinfoldSex}`,
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

    return {
      ...base,
      weight_value: toNum(weight),
      weight_unit: "lb",
      body_fat_percent: toNum(bodyFat),
      body_fat_method: source,
      waist_value: source === "three_d_scan" ? toNum(waist) : null,
      chest_value: source === "three_d_scan" ? toNum(chest) : null,
      hip_value: source === "three_d_scan" ? toNum(hip) : null,
      scan_json: {
        scan_type: source,
        facility_or_device: scanFacility.trim() || null,
        fat_mass_lb: toNum(scanFatMass),
        lean_mass_lb: toNum(scanLeanMass),
        bone_mass_lb: toNum(scanBoneMass),
        visceral_fat: toNum(scanVisceral),
        skeletal_muscle_mass_lb: toNum(scanSkeletalMuscle),
      },
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

    if (keys.some((k) => payload[k] != null)) return true;

    const scan = payload.scan_json || {};
    if (Object.values(scan).some((v) => v != null && v !== "")) return true;

    const skinfolds = payload.skinfolds_json?.sites || {};
    if (Object.values(skinfolds).some((v) => v != null && v !== "")) return true;

    return false;
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
    setFitNote("");
    setNotes("");
    setSkinfoldAge("");
    setSkinfoldSex("male");
    setSfChest("");
    setSfAbdomen("");
    setSfThigh("");
    setSfTriceps("");
    setSfSubscapular("");
    setSfSuprailiac("");
    setSfMidaxillary("");
    setScanFacility("");
    setScanFatMass("");
    setScanLeanMass("");
    setScanBoneMass("");
    setScanVisceral("");
    setScanSkeletalMuscle("");
    setFlash("");
    setStatus("");
  }

  function loadEntryForEdit(entry: MeasurementEntry) {
    const rawKind = String(entry.entry_kind || "weight");
    const kind: EntryKind =
      rawKind === "tape" || rawKind === "skinfolds" || rawKind === "scan" || rawKind === "weight"
        ? rawKind
        : "weight";

    setEntryKindWithDefaults(kind);

    setLocalDate(entry.local_date || todayLocalYYYYMMDD());
    setSource(entry.source || "manual");

    setWeight(valueText(entry.weight_value));
    setWaist(valueText(entry.waist_value));
    setAbdomen(valueText(entry.abdomen_value));
    setNeck(valueText(entry.neck_value));
    setChest(valueText(entry.chest_value));
    setHip(valueText(entry.hip_value));

    setLeftArm(valueText(entry.left_arm_value));
    setRightArm(valueText(entry.right_arm_value));
    setLeftThigh(valueText(entry.left_thigh_value));
    setRightThigh(valueText(entry.right_thigh_value));
    setLeftCalf(valueText(entry.left_calf_value));
    setRightCalf(valueText(entry.right_calf_value));

    setBodyFat(valueText(entry.body_fat_percent));

    const skinfolds = objectJson(entry.skinfolds_json);
    const sites = objectJson(skinfolds?.sites);
    if (kind === "skinfolds") {
      const formula = String(skinfolds?.formula || entry.body_fat_method || "");
      setSkinfoldSex(formula.includes("female") ? "female" : "male");
      setSkinfoldAge(valueText(skinfolds?.age));
      setSfChest(valueText(sites?.chest));
      setSfAbdomen(valueText(sites?.abdomen));
      setSfThigh(valueText(sites?.thigh));
      setSfTriceps(valueText(sites?.triceps));
      setSfSubscapular(valueText(sites?.subscapular));
      setSfSuprailiac(valueText(sites?.suprailiac));
      setSfMidaxillary(valueText(sites?.midaxillary));
    }

    const scan = objectJson(entry.scan_json);
    if (kind === "scan") {
      setScanFacility(valueText(scan?.facility_or_device));
      setScanFatMass(valueText(scan?.fat_mass_lb));
      setScanLeanMass(valueText(scan?.lean_mass_lb));
      setScanBoneMass(valueText(scan?.bone_mass_lb));
      setScanVisceral(valueText(scan?.visceral_fat));
      setScanSkeletalMuscle(valueText(scan?.skeletal_muscle_mass_lb));
    }

    setNotes(entry.notes || "");
    setFitNote("");
    setFlash("Entry loaded for editing. Save to update it.");
    setStatus("");
  }

  async function deleteEntry(entryId: string) {
    const ok = window.confirm("Delete this measurement entry?");
    if (!ok) return;

    setDeletingId(entryId);
    setStatus("");
    setFlash("");

    try {
      await fetchJson(`/api/lifeswitch/measurements/entries/${encodeURIComponent(entryId)}/deactivate`, {
        method: "POST",
      });

      setFlash("Measurement entry deleted.");
      await loadEntries();
    } catch (e: any) {
      setStatus(String(e?.message || e));
    } finally {
      setDeletingId(null);
    }
  }

  const latest = entries[0] || null;

  return (
    <div className="mx-auto max-w-5xl p-4 pb-28">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Measurements · Capture</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log weight, tape, skinfolds, and body scans as separate measurement events.
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
            <SelectField label="Entry type" value={entryKind} onChange={(v) => setEntryKindWithDefaults(v as EntryKind)}>
              <option value="weight">Weight</option>
              <option value="tape">Tape measurements</option>
              <option value="skinfolds">Skinfolds / calipers</option>
              <option value="scan">Body scan</option>
            </SelectField>

            {entryKind === "weight" ? (
              <SelectField label="Scale" value={source} onChange={setSource}>
                <option value="home_scale">Home scale</option>
                <option value="professional_scale">Professional scale</option>
                <option value="other_scale">Other scale</option>
              </SelectField>
            ) : null}

            {entryKind === "tape" ? (
              <SelectField label="Tape setup" value={source} onChange={setSource}>
                <option value="self_tape">Self-measured</option>
                <option value="assisted_tape">Assisted measurement</option>
              </SelectField>
            ) : null}

            {entryKind === "skinfolds" ? (
              <>
                <SelectField label="Caliper" value={source} onChange={setSource}>
                  <option value="harpenden">Harpenden caliper</option>
                  <option value="other_caliper">Other caliper</option>
                </SelectField>
              </>
            ) : null}

            {entryKind === "scan" ? (
              <SelectField label="Scan type" value={source} onChange={setSource}>
                <option value="dexa">DEXA</option>
                <option value="inbody">InBody</option>
                <option value="three_d_scan">3D scan</option>
                <option value="bodpod">BodPod</option>
                <option value="hydrostatic">Hydrostatic weighing</option>
                <option value="other_scan">Other scan</option>
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
                <Field label="Scale body-fat % (optional)" value={bodyFat} onChange={setBodyFat} placeholder="15.5" />
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

          {entryKind === "skinfolds" ? (
            <section className="mt-6 rounded-xl border p-4">
              <div className="text-sm font-semibold">Skinfolds / calipers</div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Harpenden/Jackson-Pollock 7-site entry. Take each site consistently. A good default is 2–3 readings per site and use the average or median.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <Field label="Age" value={skinfoldAge} onChange={setSkinfoldAge} placeholder="62" />

                <SelectField
                  label="Sex equation"
                  value={skinfoldSex}
                  onChange={(v) => setSkinfoldSex(v as "male" | "female")}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </SelectField>

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
                <Field label="Chest skinfold (mm)" value={sfChest} onChange={setSfChest} help="Diagonal fold halfway between the front armpit line and nipple." />
                <Field label="Abdomen skinfold (mm)" value={sfAbdomen} onChange={setSfAbdomen} help="Vertical fold about 1 inch to the side of the navel." />
                <Field label="Thigh skinfold (mm)" value={sfThigh} onChange={setSfThigh} help="Vertical fold on the front midline of the thigh, halfway between hip crease and kneecap." />
                <Field label="Triceps skinfold (mm)" value={sfTriceps} onChange={setSfTriceps} help="Vertical fold on the back of the upper arm, halfway between shoulder and elbow." />
                <Field label="Subscapular skinfold (mm)" value={sfSubscapular} onChange={setSfSubscapular} help="Diagonal fold just below the lower angle of the shoulder blade." />
                <Field label="Suprailiac skinfold (mm)" value={sfSuprailiac} onChange={setSfSuprailiac} help="Diagonal fold just above the hip bone along the natural crease." />
                <Field label="Midaxillary skinfold (mm)" value={sfMidaxillary} onChange={setSfMidaxillary} help="Vertical fold on the side of the torso at the level of the sternum/xiphoid." />
              </div>
            </section>
          ) : null}

          {entryKind === "scan" ? (
            <section className="mt-6 rounded-xl border p-4">
              <div className="text-sm font-semibold">Body scan result</div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Enter the main values reported by a DEXA, InBody, BodPod, hydrostatic test, or 3D scan.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <TextField label="Facility / device" value={scanFacility} onChange={setScanFacility} />
                <Field label="Weight (lb)" value={weight} onChange={setWeight} />
                <Field label="Body fat %" value={bodyFat} onChange={setBodyFat} />
                <Field label="Fat mass (lb)" value={scanFatMass} onChange={setScanFatMass} />
                <Field label="Lean mass (lb)" value={scanLeanMass} onChange={setScanLeanMass} />
                <Field label="Bone mass / BMC (lb)" value={scanBoneMass} onChange={setScanBoneMass} />
                <Field label="Visceral fat / VAT" value={scanVisceral} onChange={setScanVisceral} />
                <Field label="Skeletal muscle mass (lb)" value={scanSkeletalMuscle} onChange={setScanSkeletalMuscle} />
                {source === "three_d_scan" ? (
                  <>
                    <Field label="Waist (in)" value={waist} onChange={setWaist} />
                    <Field label="Chest (in)" value={chest} onChange={setChest} />
                    <Field label="Hip (in)" value={hip} onChange={setHip} />
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {entryKind === "weight" || entryKind === "tape" ? (
            <SelectField
              label="Fit / appearance note"
              value={fitNote}
              onChange={setFitNote}
              help="Optional qualitative context. Useful when scale and tape disagree."
            >
              <option value="">No note</option>
              <option value="looser">Clothes fitting looser</option>
              <option value="same">About the same</option>
              <option value="tighter">Clothes fitting tighter</option>
              <option value="visibly_leaner">Visibly leaner</option>
              <option value="bloated_watery">Bloated / watery</option>
            </SelectField>
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
              {saving ? "Saving..." : `Save ${displayKind(entryKind).toLowerCase()} entry`}
            </button>

            <button type="button" className="rounded-xl border px-4 py-2 text-sm hover:bg-muted/30" onClick={clearForm}>
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
                <div>Type: {displayKind(latest.entry_kind)}</div>
                {latest.weight_value != null ? <div>Weight: {latest.weight_value} {latest.weight_unit || "lb"}</div> : null}
                {latest.waist_value != null ? <div>Waist: {latest.waist_value} {latest.measurement_unit || "in"}</div> : null}
                {latest.body_fat_percent != null ? <div>Body fat: {latest.body_fat_percent}%</div> : null}
                <div>Source: {latest.source || "manual"}</div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border p-3 text-sm text-muted-foreground">No measurement entries yet.</div>
          )}

          <div className="mt-4 space-y-2">
            {entries.slice(0, 8).map((entry) => (
              <div key={entry.measurement_entry_id} className="rounded-xl border p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{entry.local_date}</div>
                    <div className="mt-1 text-muted-foreground">
                      {displayKind(entry.entry_kind)} · {entrySummary(entry)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="rounded-md border px-2 py-1 text-[11px] hover:bg-muted/30"
                      onClick={() => loadEntryForEdit(entry)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="rounded-md border px-2 py-1 text-[11px] hover:bg-muted/30 disabled:opacity-50"
                      disabled={deletingId === entry.measurement_entry_id}
                      onClick={() => void deleteEntry(entry.measurement_entry_id)}
                    >
                      {deletingId === entry.measurement_entry_id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
