"use client";

import { authFetch } from "@/lib/authFetch";
import {
  readPlanNutritionTargets,
  type PlanNutritionTargetConfig,
} from "@/lib/lifeswitch/planNutritionTargets";
import {
  scoreNutritionDay,
  scoreNutritionRollingWindow,
} from "@/lib/lifeswitch/nutritionScoring";
import {
  recoveryDaysForDomain,
  type RecoveryAdjustment,
} from "@/lib/lifeswitch/recoveryAdjustments";
import {
  MiniLineChart,
  type XYPoint,
  type YReferenceBand,
  type YReferenceLine,
} from "@/components/sslg/MiniLineChart";
import * as React from "react";

type RangeDays = 7 | 14 | 30 | 90;
type NutritionMetric = "kcal" | "protein_g" | "carbs_g" | "fat_g";

const NUTRITION_METRICS: Array<{
  value: NutritionMetric;
  label: string;
  yLabel: string;
  suffix: string;
}> = [
  { value: "kcal", label: "Calories", yLabel: "Calories", suffix: " kcal" },
  { value: "protein_g", label: "Protein", yLabel: "Protein", suffix: "g" },
  { value: "carbs_g", label: "Carbs", yLabel: "Carbs", suffix: "g" },
  { value: "fat_g", label: "Fat", yLabel: "Fat", suffix: "g" },
];

function analysisChoiceClassName(active: boolean) {
  return `inline-flex min-h-11 min-w-11 items-center justify-center border-b-2 px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
    active
      ? "border-foreground text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground"
  }`;
}

type DaySummary = {
  day: string;
  raw: any;
  any: boolean;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  completedAt: string | null;
  finalized: boolean;
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

async function fetchJson(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const r = await authFetch(url, {
      cache: "no-store",
      ...(init || {}),
      signal: init?.signal || controller.signal,
    });
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
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Nutrition request timed out. Try Refresh.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
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

function dayMetricSeries(days: DaySummary[], key: keyof DaySummary): XYPoint[] {
  const points: XYPoint[] = [];

  for (const d of days) {
    if (!d.any) continue;

    const y = safeNum(d[key], Number.NaN);
    if (!Number.isFinite(y)) continue;

    points.push({
      x: d.day,
      y,
      id: d.day,
      occurred_at: d.day,
      sort_ts: d.day,
      data: d,
    });
  }

  return points.sort((a, b) => String(a.sort_ts || a.x).localeCompare(String(b.sort_ts || b.x)));
}

export default function NutritionAnalyzePage() {
  const [rangeDays, setRangeDays] = React.useState<RangeDays>(30);
  const [status, setStatus] = React.useState("loading…");
  const [loading, setLoading] = React.useState(true);
  const [nutritionTargets, setNutritionTargets] = React.useState<PlanNutritionTargetConfig>(
    () => readPlanNutritionTargets(null),
  );
  const [targetSource, setTargetSource] = React.useState("Plan targets not loaded");
  const [days, setDays] = React.useState<DaySummary[]>([]);
  const [recoveryAdjustments, setRecoveryAdjustments] = React.useState<
    RecoveryAdjustment[]
  >([]);
  const [nutritionMetric, setNutritionMetric] = React.useState<NutritionMetric>("kcal");
  const showDebug =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

  const today = React.useMemo(() => todayLocalYYYYMMDD(), []);
  const startDay = React.useMemo(() => daysAgoYYYYMMDD(rangeDays - 1), [rangeDays]);

  async function loadRows() {
    setLoading(true);
    setStatus("loading nutrition analysis…");

    try {
      let nextTargets = readPlanNutritionTargets(null);
      let nextTargetSource = "No calorie or protein targets found";

      try {
        const activePlanJson = await fetchJson("/api/lifeswitch/plan/agentic/active");
        const activeDocument = activePlanJson?.active_plan?.document;

        if (
          activeDocument &&
          typeof activeDocument === "object" &&
          !Array.isArray(activeDocument)
        ) {
          nextTargets = readPlanNutritionTargets(activeDocument.nutrition_targets || {});
          nextTargetSource = "Active Plan";
        } else {
          const legacyPlanJson = await fetchJson(
            "/api/lifeswitch/plan/profile?create_if_missing=0",
          );
          nextTargets = readPlanNutritionTargets(legacyPlanJson?.nutrition_targets || {});
          nextTargetSource = "Legacy Plan profile";
        }
      } catch (targetError: any) {
        nextTargetSource = `Plan targets unavailable: ${String(targetError?.message || targetError)}`;
      }

      setNutritionTargets(nextTargets);
      setTargetSource(nextTargetSource);

      const recoveryUrl = new URL(
        "/api/lifeswitch/plan/agentic/recovery-adjustments",
        window.location.origin,
      );
      recoveryUrl.searchParams.set("starts_on", daysAgoYYYYMMDD(89));
      recoveryUrl.searchParams.set("ends_on", todayLocalYYYYMMDD());
      const rangeUrl = new URL("/api/lifeswitch/nutrition/log/range", window.location.origin);
      rangeUrl.searchParams.set("start_day", daysAgoYYYYMMDD(89));
      rangeUrl.searchParams.set("end_day", todayLocalYYYYMMDD());
      rangeUrl.searchParams.set("include_entries", "0");
      const [rangeJson, recoveryJson] = await Promise.all([
        fetchJson(rangeUrl.toString()),
        fetchJson(recoveryUrl.toString()),
      ]);
      const rangeRows = Array.isArray(rangeJson?.days) ? rangeJson.days : [];
      setRecoveryAdjustments(
        Array.isArray(recoveryJson?.recovery_adjustments)
          ? recoveryJson.recovery_adjustments
          : [],
      );

      const out: DaySummary[] = rangeRows
        .map((rangeDay: any) => {
          const day = String(rangeDay?.day?.day || "");
          const raw = {
            day: rangeDay?.day || null,
            totals: rangeDay?.totals || {},
          };
          const t = extractTotals(raw);
          const any = hasAnyData(raw, t);
          const completedAt = raw?.day?.completed_at
            ? String(raw.day.completed_at)
            : null;
          const finalized = day < todayLocalYYYYMMDD() || Boolean(completedAt);

          return {
            day,
            raw,
            any,
            ...t,
            completedAt,
            finalized,
          };
        })
        .filter((summary: DaySummary) => /^\d{4}-\d{2}-\d{2}$/.test(summary.day));

      setDays(out);
      setStatus(`loaded ${out.filter((summary) => summary.any).length} logged days`);
    } catch (e: any) {
      setDays([]);
      setRecoveryAdjustments([]);
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
  const finalizedLoggedDays = React.useMemo(
    () => loggedDays.filter((d) => d.finalized),
    [loggedDays],
  );
  const inProgressDays = React.useMemo(
    () => loggedDays.filter((d) => !d.finalized),
    [loggedDays],
  );

  const summary = React.useMemo(() => {
    const denom = Math.max(1, finalizedLoggedDays.length);

    const kcalAvg = finalizedLoggedDays.reduce((acc, d) => acc + safeNum(d.kcal, 0), 0) / denom;
    const proteinAvg = finalizedLoggedDays.reduce((acc, d) => acc + safeNum(d.protein_g, 0), 0) / denom;
    const carbsAvg = finalizedLoggedDays.reduce((acc, d) => acc + safeNum(d.carbs_g, 0), 0) / denom;
    const fatAvg = finalizedLoggedDays.reduce((acc, d) => acc + safeNum(d.fat_g, 0), 0) / denom;

    return {
      loggedDays: loggedDays.length,
      finalizedDays: finalizedLoggedDays.length,
      inProgressDays: inProgressDays.length,
      missingDays: Math.max(0, rangeDays - loggedDays.length),
      kcalAvg,
      proteinAvg,
      carbsAvg,
      fatAvg,
    };
  }, [finalizedLoggedDays, inProgressDays.length, loggedDays.length, rangeDays]);

  const nutritionRecoveryDays = React.useMemo(
    () => recoveryDaysForDomain(recoveryAdjustments, "nutrition"),
    [recoveryAdjustments],
  );
  const dailyScores = React.useMemo(
    () =>
      finalizedLoggedDays.map((day) => ({
        day,
        score: scoreNutritionDay(
          {
            day: day.day,
            logged: day.any,
            finalized: day.finalized,
            adherenceExcluded: nutritionRecoveryDays.has(day.day),
            kcal: day.kcal,
            proteinG: day.protein_g,
          },
          nutritionTargets,
        ),
      })),
    [finalizedLoggedDays, nutritionRecoveryDays, nutritionTargets],
  );
  const calorieEvaluableDays = dailyScores.filter(
    ({ score }) => score.calorieStatus !== "not_evaluable",
  );
  const calorieHitDays = calorieEvaluableDays.filter(
    ({ score }) => score.calorieStatus === "hit",
  ).length;
  const proteinEvaluableDays = dailyScores.filter(
    ({ score }) => score.proteinStatus !== "not_evaluable",
  );
  const proteinHitDays = proteinEvaluableDays.filter(
    ({ score }) => score.proteinStatus === "hit",
  ).length;

  const currentDay = days.find((day) => day.day === today) || null;
  const rollingAsOfDay = currentDay?.completedAt ? today : daysAgoYYYYMMDD(1);
  const rollingScore = React.useMemo(
    () =>
      scoreNutritionRollingWindow(
        days.map((day) => ({
          day: day.day,
          logged: day.any,
          finalized: day.finalized,
          kcal: day.kcal,
          proteinG: day.protein_g,
        })),
        rollingAsOfDay,
        nutritionTargets,
        { excludedDays: nutritionRecoveryDays },
      ),
    [days, nutritionRecoveryDays, nutritionTargets, rollingAsOfDay],
  );

  const rollingStatusLabel =
    rollingScore.status === "hit"
      ? "Hit"
      : rollingScore.status === "not_hit"
        ? "Not hit"
        : rollingScore.status === "insufficient_data"
          ? "Needs more logged days"
          : rollingScore.status === "paused"
            ? "Paused for recovery"
          : "Not configured";
  const rollingStatusClass =
    rollingScore.status === "hit"
      ? "text-emerald-700 dark:text-emerald-300"
      : rollingScore.status === "not_hit"
        ? "text-amber-700 dark:text-amber-300"
        : rollingScore.status === "paused"
          ? "text-violet-700 dark:text-violet-300"
          : "text-muted-foreground";
  const calorieTargetLabel = nutritionTargets.dailyRangeKcal
    ? `${nutritionTargets.dailyRangeKcal.lower}–${nutritionTargets.dailyRangeKcal.upper} kcal acceptable daily range`
    : nutritionTargets.nominalKcal != null
      ? `${nutritionTargets.nominalKcal} kcal target · acceptable range not set`
      : "No calorie target configured";
  const proteinTargetLabel = nutritionTargets.proteinMinimumG != null
    ? `${nutritionTargets.proteinMinimumG}g minimum${nutritionTargets.proteinWeeklyAdherence
      ? ` · required ${nutritionTargets.proteinWeeklyAdherence.requiredHitDays}/${nutritionTargets.proteinWeeklyAdherence.windowDays} days`
      : ""}`
    : "No protein target configured";
  const rollingTargetLabel = nutritionTargets.rollingAverageKcal
    ? `${nutritionTargets.rollingAverageKcal.windowDays}-day calorie average ${nutritionTargets.rollingAverageKcal.lower}–${nutritionTargets.rollingAverageKcal.upper} kcal`
    : null;

  const selectedMetric =
    NUTRITION_METRICS.find((metric) => metric.value === nutritionMetric) ??
    NUTRITION_METRICS[0];
  const nutritionSeries = React.useMemo(
    () => dayMetricSeries(finalizedLoggedDays, nutritionMetric),
    [finalizedLoggedDays, nutritionMetric],
  );
  const selectedMetricTargetLabel =
    nutritionMetric === "kcal"
      ? [calorieTargetLabel, rollingTargetLabel].filter(Boolean).join(" · ")
      : nutritionMetric === "protein_g"
        ? proteinTargetLabel
        : "No Plan target is scored for this metric.";
  const nutritionReferenceBands: YReferenceBand[] =
    nutritionMetric === "kcal" && nutritionTargets.dailyRangeKcal
      ? [{
          lower: nutritionTargets.dailyRangeKcal.lower,
          upper: nutritionTargets.dailyRangeKcal.upper,
          label: "acceptable daily range",
        }]
      : [];
  const nutritionReferenceLines: YReferenceLine[] =
    nutritionMetric === "kcal" && nutritionTargets.nominalKcal != null
      ? [{ y: nutritionTargets.nominalKcal, label: `${nutritionTargets.nominalKcal} kcal target` }]
      : nutritionMetric === "protein_g" && nutritionTargets.proteinMinimumG != null
        ? [{ y: nutritionTargets.proteinMinimumG, label: `${nutritionTargets.proteinMinimumG}g minimum` }]
        : [];

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <h1 className="text-xl font-semibold">Nutrition · Analyze</h1>
          <div className="mt-1 text-xs text-muted-foreground">{startDay} → {today}</div>
        </div>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Analysis range">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              className={analysisChoiceClassName(rangeDays === d)}
              aria-pressed={rangeDays === d}
              onClick={() => setRangeDays(d as RangeDays)}
            >
              {d}d
            </button>
          ))}

          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => void loadRows()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {showDebug ? (
        <details className="mt-4">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground">Debug</summary>
          <div className="mt-2 space-y-1 text-xs font-mono text-muted-foreground">
            <div>status: {status}</div>
            <div>target source: {targetSource}</div>
            <div>days loaded: {days.length}</div>
            <div>logged days in range: {summary.loggedDays}</div>
            <div>completed logged days in range: {summary.finalizedDays}</div>
          </div>
        </details>
      ) : null}

      {status.startsWith("error:") ? (
        <div role="alert" className="mt-4 border-y border-red-700/40 py-3 text-sm text-red-700 dark:text-red-300">
          Nutrition analysis unavailable: {status.slice("error:".length).trim()}
        </div>
      ) : null}

      <section className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border/50 py-3 md:grid-cols-4">
        <MetricCard
          label="Logged days"
          value={summary.loggedDays}
          sub={`${summary.finalizedDays} completed · ${summary.missingDays} with no intake${summary.inProgressDays ? ` · ${summary.inProgressDays} in progress` : ""}`}
        />
        <MetricCard
          label="Avg calories"
          value={summary.finalizedDays ? fmt0(summary.kcalAvg) : "—"}
          sub={calorieTargetLabel}
        />
        <MetricCard
          label="Avg protein"
          value={summary.finalizedDays ? `${fmt1(summary.proteinAvg)}g` : "—"}
          sub={proteinTargetLabel}
        />
        <MetricCard
          label="Avg macros"
          value={summary.finalizedDays ? `${fmt1(summary.carbsAvg)}C / ${fmt1(summary.fatAvg)}F` : "—"}
          sub="completed-day average grams"
        />
      </section>

      <section className="mt-6 border-y border-border/50 py-4" aria-labelledby="nutrition-adherence-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="nutrition-adherence-title" className="text-sm font-semibold">Plan vs actual · Nutrition adherence</h2>
            <div className="mt-1 text-xs text-muted-foreground">{targetSource}</div>
          </div>
          {rollingScore.windowDays ? (
            <div className={`text-xs font-semibold tracking-wide uppercase ${rollingStatusClass}`}>
              {rollingScore.windowDays}-day check · {rollingStatusLabel}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid divide-y divide-border/50 border-y border-border/50 md:grid-cols-3 md:divide-x md:divide-y-0">
          <MetricCard
            className="py-3 md:px-3"
            label="Data"
            value={rollingScore.windowDays
              ? `${rollingScore.loggedDays}/${rollingScore.eligibleDays}`
              : `${summary.finalizedDays}/${rangeDays}`}
            sub={rollingScore.windowDays
              ? `${rollingScore.excludedDays} recovery-adjusted · through ${rollingAsOfDay}`
              : "completed logged days in selected range"}
          />
          <MetricCard
            className="py-3 md:px-3"
            label="Calories"
            value={nutritionTargets.rollingAverageKcal
              ? rollingScore.calorieAverage == null
                ? "—"
                : `${fmt0(rollingScore.calorieAverage)} avg`
              : nutritionTargets.dailyRangeKcal
                ? `${calorieHitDays}/${calorieEvaluableDays.length}`
                : "Not scored"}
            sub={nutritionTargets.rollingAverageKcal
              ? `${nutritionTargets.rollingAverageKcal.lower}–${nutritionTargets.rollingAverageKcal.upper} kcal rolling range`
              : nutritionTargets.dailyRangeKcal
                ? `${nutritionTargets.dailyRangeKcal.lower}–${nutritionTargets.dailyRangeKcal.upper} kcal completed days`
                : calorieTargetLabel}
          />
          <MetricCard
            className="py-3 md:px-3"
            label="Protein"
            value={nutritionTargets.proteinWeeklyAdherence
              ? `${rollingScore.proteinDaysMeetingMinimum ?? 0}/${rollingScore.eligibleDays}`
              : nutritionTargets.proteinMinimumG != null
                ? `${proteinHitDays}/${proteinEvaluableDays.length}`
                : "Not scored"}
            sub={nutritionTargets.proteinWeeklyAdherence
              ? `required ${rollingScore.proteinRequiredHitDays ?? "—"} eligible days at or above ${nutritionTargets.proteinMinimumG ?? "—"}g`
              : proteinTargetLabel}
          />
        </div>

        <details className="mt-2 border-t border-border/40 pt-1">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground hover:text-foreground">
            How this is calculated
          </summary>
          <div className="pb-2 text-xs text-muted-foreground">
            Completed eligible days are scored. Unfinished and recovery-adjusted days are excluded from adherence.
          </div>
        </details>
      </section>

      <section className="mt-6 border-y border-border/50 py-4" aria-labelledby="nutrition-trends-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="nutrition-trends-title" className="text-sm font-semibold">Nutrition trends</h2>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Graph</div>
            <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Nutrition metric">
              {NUTRITION_METRICS.map((metric) => (
                <button
                  key={metric.value}
                  type="button"
                  className={analysisChoiceClassName(nutritionMetric === metric.value)}
                  aria-pressed={nutritionMetric === metric.value}
                  onClick={() => setNutritionMetric(metric.value)}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 border-l-2 border-border/60 pl-3 text-xs text-muted-foreground">
          {selectedMetricTargetLabel}
        </div>

        <div className="mt-4">
          <MiniLineChart
            title={`${selectedMetric.label} per completed logged day`}
            series={nutritionSeries}
            xMode="date"
            xLabel="Completed logged days · oldest to newest"
            yLabel={selectedMetric.yLabel}
            ySuffix={selectedMetric.suffix}
            yReferenceBands={nutritionReferenceBands}
            yReferenceLines={nutritionReferenceLines}
            includeZero={false}
            heightPx={300}
          />
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
