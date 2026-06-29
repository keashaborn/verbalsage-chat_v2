"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";

type RangeDays = 7 | 14 | 30 | 90;

type DaySummary = {
  day: string;
  raw: any;
  any: boolean;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  calorieHit: boolean;
  proteinHit: boolean;
  fullHit: boolean;
};

type PlanProfile = {
  plan_profile_id?: string;
  phase?: string;
  nutrition_targets?: Record<string, any>;
  [key: string]: any;
};

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function todayLocalYYYYMMDD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function daysAgoYYYYMMDD(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function fmt1(x: number) {
  return (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, "");
}

function fmt0(x: number) {
  return String(Math.round(safeNum(x, 0)));
}

function firstNumber(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").replace(/,/g, " ").trim();
  if (!raw) return null;
  const m = raw.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function calorieTargetFromPlan(plan: PlanProfile | null): number | null {
  const t = plan?.nutrition_targets || {};
  return firstNumber(t.calories ?? t.target_kcal ?? t.kcal);
}

function proteinTargetFromPlan(plan: PlanProfile | null): number | null {
  const t = plan?.nutrition_targets || {};
  return firstNumber(t.protein_g ?? t.target_protein_g ?? t.protein);
}

async function fetchJson(url: string, init?: RequestInit) {
  const r = await authFetch(url, { cache: "no-store", ...(init || {}) });
  const t = await r.text().catch(() => "");
  let j: any = null;

  try {
    j = t ? JSON.parse(t) : null;
  } catch {
    // keep null
  }

  if (!r.ok) {
    const detail = j?.detail || j?.error || t?.slice(0, 300) || `HTTP ${r.status}`;
    throw new Error(String(detail));
  }

  return j;
}

function hasAnyData(raw: any, t: { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }) {
  if ((t.kcal ?? 0) > 0) return true;
  if ((t.protein_g ?? 0) > 0) return true;
  if ((t.carbs_g ?? 0) > 0) return true;
  if ((t.fat_g ?? 0) > 0) return true;

  const candidates = [
    raw?.entries,
    raw?.items,
    raw?.meals,
    raw?.log,
    raw?.data?.entries,
    raw?.result?.entries,
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return true;
  }

  return false;
}

function extractTotals(raw: any) {
  const candidates = [raw, raw?.totals, raw?.summary, raw?.day, raw?.data].filter(Boolean);

  function pick(keys: string[]) {
    for (const c of candidates) {
      for (const k of keys) {
        if (c && c[k] != null) return c[k];
      }
    }
    return null;
  }

  const kcal = pick(["kcal", "calories", "kcal_total", "calories_total"]);
  const protein_g = pick(["protein_g", "protein", "protein_total_g"]);
  const carbs_g = pick(["carbs_g", "carbs", "carbohydrates_g", "carbs_total_g"]);
  const fat_g = pick(["fat_g", "fat", "fat_total_g"]);

  if (
    kcal == null &&
    protein_g == null &&
    carbs_g == null &&
    fat_g == null &&
    Array.isArray(raw?.entries) &&
    raw.entries.length
  ) {
    let kk = 0;
    let pp = 0;
    let cc = 0;
    let ff = 0;

    for (const e of raw.entries) {
      const mk = safeNum(e?.meal_kcal, 0);
      const mp = safeNum(e?.meal_protein, 0);
      const mc = safeNum(e?.meal_carbs, 0);
      const mf = safeNum(e?.meal_fat, 0);

      if (e?.meal_id) {
        kk += mk;
        pp += mp;
        cc += mc;
        ff += mf;
        continue;
      }

      const g = safeNum(e?.qty_g, 0);
      if (g <= 0) continue;

      kk += (safeNum(e?.food_kcal_100g, 0) * g) / 100.0;
      pp += (safeNum(e?.food_protein_100g, 0) * g) / 100.0;
      cc += (safeNum(e?.food_carbs_100g, 0) * g) / 100.0;
      ff += (safeNum(e?.food_fat_100g, 0) * g) / 100.0;
    }

    return { kcal: kk, protein_g: pp, carbs_g: cc, fat_g: ff };
  }

  return {
    kcal: kcal == null ? null : safeNum(kcal, 0),
    protein_g: protein_g == null ? null : safeNum(protein_g, 0),
    carbs_g: carbs_g == null ? null : safeNum(carbs_g, 0),
    fat_g: fat_g == null ? null : safeNum(fat_g, 0),
  };
}

export default function NutritionAnalyzePage() {
  const [rangeDays, setRangeDays] = React.useState<RangeDays>(30);
  const [status, setStatus] = React.useState("loading…");
  const [loading, setLoading] = React.useState(true);
  const [plan, setPlan] = React.useState<PlanProfile | null>(null);
  const [days, setDays] = React.useState<DaySummary[]>([]);
  const showDebug =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

  const today = React.useMemo(() => todayLocalYYYYMMDD(), []);
  const startDay = React.useMemo(() => daysAgoYYYYMMDD(rangeDays - 1), [rangeDays]);

  const calorieTarget = React.useMemo(() => calorieTargetFromPlan(plan), [plan]);
  const proteinTarget = React.useMemo(() => proteinTargetFromPlan(plan), [plan]);

  async function loadRows() {
    setLoading(true);
    setStatus("loading nutrition analysis…");

    try {
      const planJson = await fetchJson("/api/lifeswitch/plan/profile?create_if_missing=1");
      setPlan(planJson && typeof planJson === "object" ? (planJson as PlanProfile) : null);

      const dayList: string[] = [];
      const base = new Date();
      for (let i = 0; i < 90; i++) {
        const d = new Date(base.getTime() - i * 24 * 3600 * 1000);
        dayList.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
      }
      dayList.sort((a, b) => b.localeCompare(a));

      const out: DaySummary[] = [];
      const chunkSize = 10;

      for (let i = 0; i < dayList.length; i += chunkSize) {
        const chunk = dayList.slice(i, i + chunkSize);

        const results = await Promise.all(
          chunk.map(async (day) => {
            const u = new URL("/api/lifeswitch/nutrition/log/day", window.location.origin);
            u.searchParams.set("day", day);

            const raw = await fetchJson(u.toString());
            const t = extractTotals(raw);
            const any = hasAnyData(raw, t);

            const kcal = t.kcal;
            const protein = t.protein_g;

            const calorieHit =
              any &&
              calorieTargetFromPlan(planJson) != null &&
              kcal != null &&
              kcal <= Number(calorieTargetFromPlan(planJson));

            const proteinHit =
              any &&
              proteinTargetFromPlan(planJson) != null &&
              protein != null &&
              protein >= Number(proteinTargetFromPlan(planJson));

            const fullHit =
              any &&
              (calorieTargetFromPlan(planJson) == null || calorieHit) &&
              (proteinTargetFromPlan(planJson) == null || proteinHit);

            return {
              day,
              raw,
              any,
              ...t,
              calorieHit,
              proteinHit,
              fullHit,
            };
          })
        );

        out.push(...results);
      }

      setDays(out);
      setStatus(`loaded ${out.length} days`);
    } catch (e: any) {
      setDays([]);
      setPlan(null);
      setStatus(`error: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadRows();
  }, []);

  const filteredDays = React.useMemo(() => {
    return days.filter((d) => d.day >= startDay && d.day <= today);
  }, [days, startDay, today]);

  const loggedDays = React.useMemo(() => filteredDays.filter((d) => d.any), [filteredDays]);

  const summary = React.useMemo(() => {
    const denom = Math.max(1, loggedDays.length);

    const kcalAvg = loggedDays.reduce((acc, d) => acc + safeNum(d.kcal, 0), 0) / denom;
    const proteinAvg = loggedDays.reduce((acc, d) => acc + safeNum(d.protein_g, 0), 0) / denom;
    const carbsAvg = loggedDays.reduce((acc, d) => acc + safeNum(d.carbs_g, 0), 0) / denom;
    const fatAvg = loggedDays.reduce((acc, d) => acc + safeNum(d.fat_g, 0), 0) / denom;

    const calorieHitDays = loggedDays.filter((d) => d.calorieHit).length;
    const proteinHitDays = loggedDays.filter((d) => d.proteinHit).length;
    const fullHitDays = loggedDays.filter((d) => d.fullHit).length;

    return {
      loggedDays: loggedDays.length,
      missingDays: Math.max(0, rangeDays - loggedDays.length),
      kcalAvg,
      proteinAvg,
      carbsAvg,
      fatAvg,
      calorieHitDays,
      proteinHitDays,
      fullHitDays,
      calorieHitPct: loggedDays.length ? Math.round((calorieHitDays / loggedDays.length) * 100) : 0,
      proteinHitPct: loggedDays.length ? Math.round((proteinHitDays / loggedDays.length) * 100) : 0,
      fullHitPct: loggedDays.length ? Math.round((fullHitDays / loggedDays.length) * 100) : 0,
    };
  }, [loggedDays, rangeDays]);

  const nutritionTargets = plan?.nutrition_targets || {};

  return (
    <div className="mx-auto max-w-6xl p-4 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Nutrition · Analyze</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Read-only nutrition dashboard from logged intake and current Plan targets.
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Range: {startDay} → {today}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              className={`rounded-full border px-3 py-1 text-sm ${rangeDays === d ? "border-foreground bg-foreground text-background" : "hover:bg-muted/20"}`}
              onClick={() => setRangeDays(d as RangeDays)}
            >
              {d}d
            </button>
          ))}

          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30"
            onClick={() => void loadRows()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {showDebug ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground">Debug</summary>
          <div className="mt-2 space-y-1 text-xs font-mono text-muted-foreground">
            <div>status: {status}</div>
            <div>days loaded: {days.length}</div>
            <div>logged days in range: {summary.loggedDays}</div>
          </div>
        </details>
      ) : null}

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Logged days" value={summary.loggedDays} sub={`${summary.missingDays} days with no intake logged`} />
        <MetricCard label="Avg calories" value={fmt0(summary.kcalAvg)} sub={calorieTarget ? `target ${calorieTarget}` : "no plan target"} />
        <MetricCard label="Avg protein" value={`${fmt1(summary.proteinAvg)}g`} sub={proteinTarget ? `target ${proteinTarget}g` : "no plan target"} />
        <MetricCard label="Avg macros" value={`${fmt1(summary.carbsAvg)}C / ${fmt1(summary.fatAvg)}F`} sub="daily average grams" />
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <MetricCard label="Calorie target" value={`${summary.calorieHitPct}%`} sub={`${summary.calorieHitDays}/${summary.loggedDays} logged days`} />
        <MetricCard label="Protein target" value={`${summary.proteinHitPct}%`} sub={`${summary.proteinHitDays}/${summary.loggedDays} logged days`} />
        <MetricCard label="Full nutrition hit" value={`${summary.fullHitPct}%`} sub={`${summary.fullHitDays}/${summary.loggedDays} logged days`} />
      </section>

      <section className="mt-6 rounded-xl border p-4">
        <div className="text-sm font-semibold">Current Plan targets</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Info label="Phase" value={plan?.phase || "—"} />
          <Info label="Calories" value={String(nutritionTargets.calories ?? nutritionTargets.target_kcal ?? nutritionTargets.kcal ?? "—")} />
          <Info label="Protein" value={String(nutritionTargets.protein_g ?? nutritionTargets.target_protein_g ?? nutritionTargets.protein ?? "—")} />
          <Info label="Macros" value={String(nutritionTargets.macro_notes ?? nutritionTargets.carbs_fat ?? nutritionTargets.macros ?? "—")} />
          <Info label="Meal structure" value={String(nutritionTargets.meal_structure ?? nutritionTargets.meals ?? nutritionTargets.meal_timing ?? "—")} />
          <Info label="Adherence target" value={String(nutritionTargets.adherence_target ?? nutritionTargets.adherence ?? "—")} />
        </div>
      </section>

      <section className="mt-6 rounded-xl border p-4">
        <div className="text-sm font-semibold">Current read</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {summary.loggedDays ? (
            <>
              In the selected range, intake was logged on {summary.loggedDays} of {rangeDays} days.
              Average intake was {fmt0(summary.kcalAvg)} kcal and {fmt1(summary.proteinAvg)}g protein.
              {calorieTarget ? ` Calories were at or below target on ${summary.calorieHitDays} logged days.` : " No calorie target is available from Plan."}
              {proteinTarget ? ` Protein met target on ${summary.proteinHitDays} logged days.` : " No protein target is available from Plan."}
            </>
          ) : (
            <>No logged nutrition days were found in this range.</>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Recent nutrition days</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Daily totals from the nutrition truth ledger.
            </div>
          </div>
          <div className="text-xs text-muted-foreground">count={loggedDays.length}</div>
        </div>

        {loggedDays.length ? (
          <div className="mt-4 space-y-3">
            {loggedDays.slice(0, 20).map((d) => (
              <div key={d.day} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      {d.day} {d.fullHit ? "· HIT" : ""}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      kcal {fmt0(safeNum(d.kcal, 0))} · protein {fmt1(safeNum(d.protein_g, 0))}g · carbs {fmt1(safeNum(d.carbs_g, 0))}g · fat {fmt1(safeNum(d.fat_g, 0))}g
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {d.calorieHit ? "calorie hit" : "calorie miss"} · {d.proteinHit ? "protein hit" : "protein miss"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border p-4 text-sm text-muted-foreground">
            No logged nutrition days in this range.
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border p-4">
        <div className="text-sm font-semibold">Graph explorer</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Trend graphs will appear here once graph controls are enabled.
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
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
