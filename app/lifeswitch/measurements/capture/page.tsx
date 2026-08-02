"use client";

import * as React from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { NumericInput } from "@/components/lifeswitch/NumericInput";
import {
  segmentTabClassName,
  segmentTabListClassName,
} from "@/components/lifeswitch/SegmentTabs";

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
        className="mt-2 min-h-11 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
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
        className="mt-2 min-h-11 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
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
        className="mt-2 min-h-11 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
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
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Measurements
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">
          Record measurements
        </h1>

        <input
          aria-label="Measurement date"
          type="date"
          value={localDate}
          onChange={(e) => setLocalDate(e.currentTarget.value)}
          className="min-h-11 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
        />
      </div>

      {status ? (
        <div
          role="alert"
          className="mt-4 border-y border-red-500/30 py-3 text-sm text-red-600"
        >
          {status}
        </div>
      ) : null}

      <section className="mt-6" aria-label="Measurement entry">
        <div
          className={`${segmentTabListClassName} grid-cols-2 sm:grid-cols-4`}
          role="tablist"
          aria-label="Measurement type"
        >
          {(
            [
              ["weight", "Weight"],
              ["tape", "Tape"],
              ["skinfolds", "Skinfolds"],
              ["scan", "Body scan"],
            ] as Array<[EntryKind, string]>
          ).map(([kind, label], index) => (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={entryKind === kind}
              className={`${segmentTabClassName(entryKind === kind)} ${
                index === 2
                  ? "border-t border-l-0 border-border/40 sm:border-t-0 sm:border-l"
                  : index === 3
                    ? "border-t border-border/40 sm:border-t-0"
                    : ""
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

        {entryKind === "tape" || entryKind === "skinfolds" ? (
          <details className="mt-5 border-y py-2">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-muted-foreground hover:text-foreground">
              Measurement guidance
            </summary>
            {entryKind === "tape" ? (
              <p className="pb-3 text-sm leading-relaxed text-muted-foreground">
                Use the same tape, posture, anatomical locations, and time of
                day. Keep the tape flat and snug without compressing tissue.
              </p>
            ) : (
              <div className="space-y-3 pb-3 text-sm leading-relaxed text-muted-foreground">
                <p>
                  For the Jackson–Pollock 7-site method, take 2–3 readings at
                  each site and use the average or median.
                </p>
                <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-foreground">Chest</dt>
                    <dd>
                      Diagonal fold halfway between the front armpit line and
                      nipple.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Abdomen</dt>
                    <dd>
                      Vertical fold about 1 inch to the side of the navel.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Thigh</dt>
                    <dd>
                      Vertical fold midway between hip crease and kneecap.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Triceps</dt>
                    <dd>Vertical fold midway between shoulder and elbow.</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Subscapular</dt>
                    <dd>
                      Diagonal fold below the lower angle of the shoulder blade.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Suprailiac</dt>
                    <dd>
                      Diagonal fold above the hip bone along the natural crease.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Midaxillary</dt>
                    <dd>
                      Vertical fold at the side of the torso, level with the
                      sternum.
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </details>
        ) : null}

        {entryKind === "weight" ? (
          <section className="mt-6 border-t pt-5">
            <div className="text-sm font-semibold">Weight entry</div>
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
          <section className="mt-6 border-t pt-5">
            <div className="text-sm font-semibold">Tape measurements</div>
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
          <section className="mt-6 border-t pt-5">
            <div className="text-sm font-semibold">Skinfolds / calipers</div>
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

              <div className="border-l pl-3 text-sm">
                <div className="text-muted-foreground">7-site sum</div>
                <div className="mt-1 text-lg font-semibold">
                  {skinfoldSum != null ? `${round1(skinfoldSum)} mm` : "—"}
                </div>
              </div>

              <div className="border-l pl-3 text-sm">
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
              />
              <Field
                label="Abdomen skinfold (mm)"
                value={sfAbdomen}
                onChange={setSfAbdomen}
              />
              <Field
                label="Thigh skinfold (mm)"
                value={sfThigh}
                onChange={setSfThigh}
              />
              <Field
                label="Triceps skinfold (mm)"
                value={sfTriceps}
                onChange={setSfTriceps}
              />
              <Field
                label="Subscapular skinfold (mm)"
                value={sfSubscapular}
                onChange={setSfSubscapular}
              />
              <Field
                label="Suprailiac skinfold (mm)"
                value={sfSuprailiac}
                onChange={setSfSuprailiac}
              />
              <Field
                label="Midaxillary skinfold (mm)"
                value={sfMidaxillary}
                onChange={setSfMidaxillary}
              />
            </div>
          </section>
        ) : null}

        {entryKind === "scan" ? (
          <section className="mt-6 border-t pt-5">
            <div className="text-sm font-semibold">Body scan result</div>
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

        <details className="mt-6 border-y py-2">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-muted-foreground hover:text-foreground">
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
              className="mt-2 min-h-28 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              placeholder="Time of day, hydration, soreness, device, facility, or other measurement context."
            />
          </label>
        </details>

        {saved ? (
          <div
            aria-live="polite"
            className="mt-6 border-y border-emerald-500/30 py-4"
          >
            <div className="text-sm font-medium text-emerald-500">
              {flash || "Measurement saved."}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/lifeswitch/measurements"
                className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                View measurements
              </Link>
              <button
                type="button"
                className="min-h-11 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground"
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
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              onClick={() => void saveEntry()}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : `Save ${displayKind(entryKind).toLowerCase()}`}
            </button>

            <button
              type="button"
              className="min-h-11 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              onClick={clearForm}
            >
              Clear form
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
