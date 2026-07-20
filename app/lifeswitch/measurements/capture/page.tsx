"use client";

import * as React from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { NumericInput } from "@/components/lifeswitch/NumericInput";

export const dynamic = "force-dynamic";

type EntryKind = "weight" | "tape" | "skinfolds" | "scan";

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
    const detail =
      typeof data === "object" && data ? data.detail || data.error : text;
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

function displayKind(k?: string | null) {
  if (k === "weight") return "Weight";
  if (k === "tape") return "Tape";
  if (k === "skinfolds") return "Skinfolds";
  if (k === "scan") return "Scan";
  return k || "General";
}

function jacksonPollock7Percent(
  sum7: number,
  age: number,
  sex: "male" | "female",
): number | null {
  if (!Number.isFinite(sum7) || !Number.isFinite(age) || sum7 <= 0 || age <= 0)
    return null;

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
      {help ? (
        <div className="mt-1 text-xs leading-snug text-muted-foreground">
          {help}
        </div>
      ) : null}
      <NumericInput
        className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm"
        mode="decimal"
        min={0}
        value={value}
        onValueChange={onChange}
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
      {help ? (
        <div className="mt-1 text-xs leading-snug text-muted-foreground">
          {help}
        </div>
      ) : null}
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
      {help ? (
        <div className="mt-1 text-xs leading-snug text-muted-foreground">
          {help}
        </div>
      ) : null}
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
  const [skinfoldSex, setSkinfoldSex] = React.useState<"male" | "female">(
    "male",
  );
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

  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
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

  const skinfoldSum = skinfoldValues.every((v) => v != null)
    ? skinfoldValues.reduce((sum, v) => sum + Number(v || 0), 0)
    : null;

  const calculatedSkinfoldBodyFat =
    skinfoldSum != null
      ? jacksonPollock7Percent(skinfoldSum, Number(skinfoldAge), skinfoldSex)
      : null;

  function setEntryKindWithDefaults(next: EntryKind) {
    setEntryKind(next);

    if (next === "weight") setSource("home_scale");
    if (next === "tape") setSource("self_tape");
    if (next === "skinfolds") setSource("harpenden");
    if (next === "scan") setSource("dexa");

    setSaved(false);
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
    const scanMeasurementKeys = [
      "fat_mass_lb",
      "lean_mass_lb",
      "bone_mass_lb",
      "visceral_fat",
      "skeletal_muscle_mass_lb",
    ];
    if (
      scanMeasurementKeys.some((key) => scan[key] != null && scan[key] !== "")
    )
      return true;

    const skinfolds = payload.skinfolds_json?.sites || {};
    if (Object.values(skinfolds).some((v) => v != null && v !== ""))
      return true;

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

      const existing = await fetchJson(
        "/api/lifeswitch/measurements/entries?limit=250",
      );
      const duplicate = Array.isArray(existing)
        ? existing.some(
            (entry) =>
              String(entry?.local_date || "") === localDate &&
              String(entry?.entry_kind || "") === entryKind &&
              String(entry?.source || "") === source,
          )
        : false;

      if (duplicate) {
        throw new Error(
          `A ${displayKind(entryKind).toLowerCase()} observation from this source already exists on ${localDate}. It was not overwritten.`,
        );
      }

      await fetchJson("/api/lifeswitch/measurements/entries/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      setFlash("Measurement saved.");
      setSaved(true);
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
    setSaved(false);
    setFlash("");
    setStatus("");
  }

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <Link
        href="/lifeswitch/measurements"
        className="inline-flex rounded-lg border px-3 py-2 text-sm hover:bg-muted/30"
      >
        Back to Measurements
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Record measurements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose what you measured. Each saved item becomes a dated
            observation in your history.
          </p>
        </div>

        <input
          type="date"
          value={localDate}
          onChange={(e) => setLocalDate(e.currentTarget.value)}
          className="rounded-xl border bg-background px-3 py-2 text-sm"
        />
      </div>

      {status ? (
        <div className="mt-4 text-sm text-red-600">{status}</div>
      ) : null}

      <main className="mt-6 rounded-xl border p-4 sm:p-5">
        <div className="text-sm font-medium">What are you recording?</div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["weight", "Weight"],
              ["tape", "Tape"],
              ["skinfolds", "Skinfolds"],
              ["scan", "Body scan"],
            ] as Array<[EntryKind, string]>
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className={`rounded-xl border px-3 py-3 text-sm font-medium ${
                entryKind === kind
                  ? "bg-foreground text-background"
                  : "hover:bg-muted/30"
              }`}
              onClick={() => setEntryKindWithDefaults(kind)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 max-w-sm">
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
              Best practice: weigh at a consistent time, ideally morning after
              bathroom and before food or drink.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field
                label="Weight (lb)"
                value={weight}
                onChange={setWeight}
                placeholder="167.0"
              />
              <Field
                label="Scale body-fat % (optional)"
                value={bodyFat}
                onChange={setBodyFat}
                placeholder="15.5"
              />
            </div>
          </section>
        ) : null}

        {entryKind === "tape" ? (
          <section className="mt-6 rounded-xl border p-4">
            <div className="text-sm font-semibold">Tape measurements</div>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Use the same tape, same posture, same anatomical locations, and
              similar time of day. Keep the tape flat and snug, but do not
              compress tissue.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field
                label="Waist (in)"
                value={waist}
                onChange={setWaist}
                placeholder="36.0"
              />
              <Field
                label="Abdomen (in)"
                value={abdomen}
                onChange={setAbdomen}
                placeholder="36.2"
              />
              <Field
                label="Neck (in)"
                value={neck}
                onChange={setNeck}
                placeholder="15.75"
              />
              <Field
                label="Chest (in)"
                value={chest}
                onChange={setChest}
                placeholder="41.0"
              />
              <Field
                label="Hip (in)"
                value={hip}
                onChange={setHip}
                placeholder="38.0"
              />
            </div>

            <div className="mt-6 text-sm font-semibold">Limbs</div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field
                label="Left arm (in)"
                value={leftArm}
                onChange={setLeftArm}
              />
              <Field
                label="Right arm (in)"
                value={rightArm}
                onChange={setRightArm}
              />
              <Field
                label="Left thigh (in)"
                value={leftThigh}
                onChange={setLeftThigh}
              />
              <Field
                label="Right thigh (in)"
                value={rightThigh}
                onChange={setRightThigh}
              />
              <Field
                label="Left calf (in)"
                value={leftCalf}
                onChange={setLeftCalf}
              />
              <Field
                label="Right calf (in)"
                value={rightCalf}
                onChange={setRightCalf}
              />
            </div>
          </section>
        ) : null}

        {entryKind === "skinfolds" ? (
          <section className="mt-6 rounded-xl border p-4">
            <div className="text-sm font-semibold">Skinfolds / calipers</div>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Harpenden/Jackson-Pollock 7-site entry. Take each site
              consistently. A good default is 2–3 readings per site and use the
              average or median.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <Field
                label="Age"
                value={skinfoldAge}
                onChange={setSkinfoldAge}
                placeholder="62"
              />

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
                <div className="mt-1 text-lg font-semibold">
                  {skinfoldSum != null ? `${round1(skinfoldSum)} mm` : "—"}
                </div>
              </div>

              <div className="rounded-xl border p-3 text-sm">
                <div className="text-muted-foreground">Calculated body fat</div>
                <div className="mt-1 text-lg font-semibold">
                  {calculatedSkinfoldBodyFat != null
                    ? `${calculatedSkinfoldBodyFat}%`
                    : "—"}
                </div>
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
            <div className="text-sm font-semibold">Body scan result</div>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Enter the main values reported by a DEXA, InBody, BodPod,
              hydrostatic test, or 3D scan.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <TextField
                label="Facility / device"
                value={scanFacility}
                onChange={setScanFacility}
              />
              <Field label="Weight (lb)" value={weight} onChange={setWeight} />
              <Field label="Body fat %" value={bodyFat} onChange={setBodyFat} />
              <Field
                label="Fat mass (lb)"
                value={scanFatMass}
                onChange={setScanFatMass}
              />
              <Field
                label="Lean mass (lb)"
                value={scanLeanMass}
                onChange={setScanLeanMass}
              />
              <Field
                label="Bone mass / BMC (lb)"
                value={scanBoneMass}
                onChange={setScanBoneMass}
              />
              <Field
                label="Visceral fat / VAT"
                value={scanVisceral}
                onChange={setScanVisceral}
              />
              <Field
                label="Skeletal muscle mass (lb)"
                value={scanSkeletalMuscle}
                onChange={setScanSkeletalMuscle}
              />
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

        <details className="mt-6 rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Optional context
          </summary>

          {entryKind === "weight" || entryKind === "tape" ? (
            <div className="mt-4">
              <SelectField
                label="Fit / appearance note"
                value={fitNote}
                onChange={setFitNote}
                help="Useful when scale and tape measurements appear to disagree."
              >
                <option value="">No note</option>
                <option value="looser">Clothes fitting looser</option>
                <option value="same">About the same</option>
                <option value="tighter">Clothes fitting tighter</option>
                <option value="visibly_leaner">Visibly leaner</option>
                <option value="bloated_watery">Bloated / watery</option>
              </SelectField>
            </div>
          ) : null}

          <label className="mt-4 block text-sm">
            <div className="text-muted-foreground">Notes</div>
            <textarea
              className="mt-2 min-h-28 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              placeholder="Time of day, hydration, soreness, device, facility, or other measurement context."
            />
          </label>
        </details>

        {saved ? (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="font-medium text-emerald-500">
              {flash || "Measurement saved."}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              The dated observation is now available in Measurements.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/lifeswitch/measurements"
                className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                View measurements
              </Link>
              <button
                type="button"
                className="rounded-xl border px-4 py-2 text-sm hover:bg-muted/30"
                onClick={clearForm}
              >
                Record another
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              onClick={() => void saveEntry()}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : `Save ${displayKind(entryKind).toLowerCase()}`}
            </button>

            <button
              type="button"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-muted/30"
              onClick={clearForm}
            >
              Clear form
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
