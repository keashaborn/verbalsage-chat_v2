"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";
import {
  FoodQuantityControl,
  GRAMS_UNIT,
  type FoodQuantitySelection,
  type FoodServingOption,
} from "@/components/lifeswitch/nutrition/FoodQuantityControl";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function pad2(n: number) { return n < 10 ? `0${n}` : String(n); }
function todayLocalYYYYMMDD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function daysAgoYYYYMMDD(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function monthLabel(ym: string) {
  const mm = String(ym || "").trim().match(/^(\d{4})-(\d{2})$/);
  if (!mm) return ym || "Unknown month";
  const year = Number(mm[1]);
  const month1 = Number(mm[2]);
  return `${MONTHS[Math.max(1, Math.min(12, month1)) - 1] || "Unknown"}, ${year}`;
}
function daysInMonthUTC(year: number, month1: number) { return new Date(Date.UTC(year, month1, 0)).getUTCDate(); }
function firstDowUTC(year: number, month1: number) { return new Date(Date.UTC(year, month1 - 1, 1)).getUTCDay(); }
function safeNum(x: any, fallback = 0) { const n = Number(x); return Number.isFinite(n) ? n : fallback; }
function firstNumber(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").replace(/,/g, " ").trim();
  if (!raw) return null;
  const m = raw.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}
function formatK(n: number) {
  const x = safeNum(n, 0);
  const abs = Math.abs(x);
  if (abs >= 1_000_000) return `${Math.round((x / 1_000_000) * 10) / 10}`.replace(/\.0$/, "") + "M";
  if (abs >= 1_000) return `${Math.round(x / 1_000)}K`;
  return String(Math.round(x));
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
    try { j = t ? JSON.parse(t) : null; } catch { }
    if (!r.ok) {
      const detail = j?.detail || j?.error || t?.slice(0, 200) || `HTTP ${r.status}`;
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
type LogEntryQuantity =
  | { qty_g: number }
  | { my_food_serving_id: string; qty_servings: number };

async function patchLogEntry(nutrition_entry_id: string, quantity: LogEntryQuantity) {
  const u = new URL("/api/lifeswitch/nutrition/log/entry", window.location.origin);
  u.searchParams.set("nutrition_entry_id", nutrition_entry_id);
  if ("qty_g" in quantity) {
    u.searchParams.set("qty_g", String(quantity.qty_g));
  } else {
    u.searchParams.set("my_food_serving_id", quantity.my_food_serving_id);
    u.searchParams.set("qty_servings", String(quantity.qty_servings));
  }

  const r = await authFetch(u.toString(), { method: "PATCH", cache: "no-store" });
  const t = await r.text().catch(() => "");
  let j: any = null;
  try { j = t ? JSON.parse(t) : null; } catch { }
  if (!r.ok) throw new Error(String(j?.detail || j?.error || t?.slice(0, 200) || `HTTP ${r.status}`));
  return j;
}

async function deleteLogEntry(nutrition_entry_id: string) {
  const u = new URL("/api/lifeswitch/nutrition/log/entry", window.location.origin);
  u.searchParams.set("nutrition_entry_id", nutrition_entry_id);

  const r = await authFetch(u.toString(), { method: "DELETE", cache: "no-store" });
  const t = await r.text().catch(() => "");
  let j: any = null;
  try { j = t ? JSON.parse(t) : null; } catch { }
  if (!r.ok) throw new Error(String(j?.detail || j?.error || t?.slice(0, 200) || `HTTP ${r.status}`));
  return j;
}
type DaySummary = {
  day: string;
  raw: any;
  any: boolean;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  hit: boolean;
};

function entryQuantitySelection(entry: any): FoodQuantitySelection {
  const servingId = String(entry?.my_food_serving_id || "").trim();
  const servingQuantity = Number(entry?.qty_servings);
  if (servingId && Number.isFinite(servingQuantity) && servingQuantity > 0) {
    return { quantity: String(servingQuantity), unit: servingId };
  }
  return { quantity: String(Number(entry?.qty_g) || ""), unit: GRAMS_UNIT };
}

function entryServingSeed(entry: any): FoodServingOption[] {
  const servingId = String(entry?.my_food_serving_id || "").trim();
  const foodId = String(entry?.my_food_id || "").trim();
  const name = String(entry?.serving_name || "").trim();
  const grams = Number(entry?.serving_grams);
  if (!servingId || !foodId || !name || !Number.isFinite(grams) || grams <= 0) return [];
  return [{
    my_food_serving_id: servingId,
    my_food_id: foodId,
    name,
    grams,
    is_active: true,
  }];
}

function hasAnyData(raw: any, t: { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }) {
  // totals-based
  if ((t.kcal ?? 0) > 0) return true;
  if ((t.protein_g ?? 0) > 0) return true;
  if ((t.carbs_g ?? 0) > 0) return true;
  if ((t.fat_g ?? 0) > 0) return true;

  // structure-based (common backend shapes)
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

  // sometimes payload is { ok, detail } / { ok, day } without entries
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

  // Fallback: compute totals from entry rows if the backend didn't provide totals
  // (our /log/day returns entries with qty_g + per100g macros)
  if (
    kcal == null &&
    protein_g == null &&
    carbs_g == null &&
    fat_g == null &&
    Array.isArray(raw?.entries) &&
    raw.entries.length
  ) {
    let kk = 0, pp = 0, cc = 0, ff = 0;

    for (const e of raw.entries) {
      // meal rows: backend supplies meal_* totals
      const mk = safeNum(e?.meal_kcal, 0);
      const mp = safeNum(e?.meal_protein, 0);
      const mc = safeNum(e?.meal_carbs, 0);
      const mf = safeNum(e?.meal_fat, 0);

      if (e?.meal_id) {
        kk += mk; pp += mp; cc += mc; ff += mf;
        continue;
      }

      // food rows: qty_g * per100g
      const g = safeNum(e?.qty_g, 0);
      if (g <= 0) continue;

      kk += (safeNum(e?.food_kcal_100g, 0) * g) / 100.0;
      pp += (safeNum(e?.food_protein_100g, 0) * g) / 100.0;
      cc += (safeNum(e?.food_carbs_100g, 0) * g) / 100.0;
      ff += (safeNum(e?.food_fat_100g, 0) * g) / 100.0;
    }

    return {
      kcal: kk,
      protein_g: pp,
      carbs_g: cc,
      fat_g: ff,
    };
  }

  return {
    kcal: kcal == null ? null : safeNum(kcal, 0),
    protein_g: protein_g == null ? null : safeNum(protein_g, 0),
    carbs_g: carbs_g == null ? null : safeNum(carbs_g, 0),
    fat_g: fat_g == null ? null : safeNum(fat_g, 0),
  };
}
function fmt1tight(x: number) {
  return (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, "");
}

function entryMacros(e: any) {
  // meal rows: backend supplies meal_* totals
  if (e?.meal_id) {
    return {
      kcal: safeNum(e?.meal_kcal, 0),
      p: safeNum(e?.meal_protein, 0),
      c: safeNum(e?.meal_carbs, 0),
      f: safeNum(e?.meal_fat, 0),
    };
  }

  // food rows: qty_g * per100g
  const g = safeNum(e?.qty_g, 0);
  if (g <= 0) return { kcal: 0, p: 0, c: 0, f: 0 };

  const kcal = (safeNum(e?.food_kcal_100g, 0) * g) / 100.0;
  const p = (safeNum(e?.food_protein_100g, 0) * g) / 100.0;
  const c = (safeNum(e?.food_carbs_100g, 0) * g) / 100.0;
  const f = (safeNum(e?.food_fat_100g, 0) * g) / 100.0;

  return { kcal, p, c, f };
}
function MonthCalendar(props: {
  ym: string;
  hitDates: Set<string>;
  anyDates: Set<string>;
  today: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const { ym, hitDates, anyDates, today, selectedDate, onSelectDate } = props;
  const mm = String(ym || "").trim().match(/^(\d{4})-(\d{2})$/);
  if (!mm) return null;

  const year = Number(mm[1]);
  const month1 = Number(mm[2]);
  const dim = daysInMonthUTC(year, month1);
  const firstDow = firstDowUTC(year, month1);

  const totalCells = Math.ceil((firstDow + dim) / 7) * 7;
  const cells: Array<number | null> = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDow + 1;
    cells.push(dayNum >= 1 && dayNum <= dim ? dayNum : null);
  }

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-7 text-center text-[11px] opacity-70">
        {DOW.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 text-center text-sm">
        {cells.map((dayNum, idx) => {
          if (!dayNum) return <div key={`e-${idx}`} className="h-7" />;

          const date = `${ym}-${pad2(dayNum)}`;
          const hit = hitDates.has(date);
          const hasAny = anyDates.has(date);
          const isToday = date === today;

          const cls = [
            "h-7 flex items-center justify-center rounded-md border text-xs",
            hit
              ? "border-emerald-500/30 bg-emerald-500/10 font-semibold"
              : hasAny
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-transparent opacity-55",
            isToday ? "underline underline-offset-4" : "",
            selectedDate === date ? "ring-1 ring-blue-500/70" : "",
          ].join(" ");

          if (hasAny) {
            return (
              <button
                key={date}
                type="button"
                className={`${cls} w-full hover:brightness-125`}
                aria-label={`Open nutrition log for ${date}`}
                aria-pressed={selectedDate === date}
                onClick={() => onSelectDate(date)}
              >
                {dayNum}
              </button>
            );
          }

          return <div key={date} className={cls}>{dayNum}</div>;
        })}
      </div>
    </div>
  );
}

export default function NutritionLogPage() {
  const [targetProteinG, setTargetProteinG] = React.useState<number | null>(null);
  const [targetKcal, setTargetKcal] = React.useState<number | null>(null);
  const [targetStatus, setTargetStatus] = React.useState<string>("loading Plan targets…");

  const [targetUserId, setTargetUserId] = React.useState<string>("");
  const [targetName, setTargetName] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("loading nutrition log…");
  const [days, setDays] = React.useState<DaySummary[]>([]);
  const [expandedDay, setExpandedDay] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [editQuantityByEntryId, setEditQuantityByEntryId] = React.useState<Record<string, FoodQuantitySelection>>({});
  const [servingsByFoodId, setServingsByFoodId] = React.useState<Record<string, FoodServingOption[]>>({});
  const [servingsLoadingByFoodId, setServingsLoadingByFoodId] = React.useState<Record<string, boolean>>({});
  const [savingEntryId, setSavingEntryId] = React.useState<string>("");
  const [savedEntryId, setSavedEntryId] = React.useState<string>("");
  const [entrySaveError, setEntrySaveError] = React.useState<Record<string, string>>({});

  function targetHit(any: boolean, t: { kcal: number | null; protein_g: number | null }, kcalTarget = targetKcal, proteinTarget = targetProteinG) {
    return (
      any &&
      proteinTarget != null &&
      kcalTarget != null &&
      t.protein_g != null &&
      t.kcal != null &&
      t.protein_g >= proteinTarget &&
      t.kcal <= kcalTarget
    );
  }

  async function refreshOneDay(day: string, targetUid = targetUserId) {
    const u = new URL("/api/lifeswitch/nutrition/log/day", window.location.origin);
    u.searchParams.set("day", day);
    if (targetUid) u.searchParams.set("target_user_id", targetUid);

    const raw = await fetchJson(u.toString());
    const t = extractTotals(raw);
    const any = hasAnyData(raw, t);

    const hit = targetHit(any, t);

    setDays((prev) =>
      (prev || []).map((x) => (x.day === day ? ({ ...x, raw, any, ...t, hit } as any) : x))
    );
  }

  const today = React.useMemo(() => todayLocalYYYYMMDD(), []);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setStatus("loading nutrition log…");

      try {
        const params = new URLSearchParams(window.location.search);
        const targetUid = String(params.get("target_user_id") || "").trim();
        const targetLabel = String(params.get("target_name") || "").trim();

        if (cancelled) return;

        setTargetUserId(targetUid);
        setTargetName(targetLabel);
        setStatus(targetUid ? `loading ${targetLabel || "delegated"} nutrition…` : "loading days…");

        const planUrl = new URL("/api/lifeswitch/plan/profile", window.location.origin);
        planUrl.searchParams.set("create_if_missing", targetUid ? "0" : "1");
        if (targetUid) planUrl.searchParams.set("target_user_id", targetUid);

        let nextTargetKcal: number | null = null;
        let nextTargetProteinG: number | null = null;

        try {
          const planJson = await fetchJson(planUrl.toString());
          const nt = planJson?.nutrition_targets || {};
          nextTargetKcal = firstNumber(nt.calories ?? nt.target_kcal ?? nt.kcal);
          nextTargetProteinG = firstNumber(nt.protein_g ?? nt.target_protein_g ?? nt.protein);

          if (!cancelled) {
            setTargetKcal(nextTargetKcal);
            setTargetProteinG(nextTargetProteinG);
            setTargetStatus(
              nextTargetKcal != null || nextTargetProteinG != null
                ? "loaded from Plan"
                : "no calorie/protein targets found in Plan"
            );
          }
        } catch (e: any) {
          if (!cancelled) {
            setTargetKcal(null);
            setTargetProteinG(null);
            setTargetStatus(`Plan target error: ${e?.message || String(e)}`);
          }
        }

        const rangeUrl = new URL("/api/lifeswitch/nutrition/log/range", window.location.origin);
        rangeUrl.searchParams.set("start_day", daysAgoYYYYMMDD(59));
        rangeUrl.searchParams.set("end_day", todayLocalYYYYMMDD());
        rangeUrl.searchParams.set("include_entries", "1");
        if (targetUid) rangeUrl.searchParams.set("target_user_id", targetUid);

        const rangeJson = await fetchJson(rangeUrl.toString());
        const rangeDays = Array.isArray(rangeJson?.days) ? rangeJson.days : [];
        const out: DaySummary[] = rangeDays
          .map((rangeDay: any) => {
            const day = String(rangeDay?.day?.day || "");
            const raw = {
              day: rangeDay?.day || null,
              entries: Array.isArray(rangeDay?.entries) ? rangeDay.entries : [],
              totals: rangeDay?.totals || {},
              _target_user_id: rangeJson?._target_user_id,
              _delegated_view: rangeJson?._delegated_view,
            };
            const t = extractTotals(raw);
            const any = hasAnyData(raw, t);
            const hit = targetHit(any, t, nextTargetKcal, nextTargetProteinG);
            return { day, raw, any, ...t, hit };
          })
          .filter((summary: DaySummary) => /^\d{4}-\d{2}-\d{2}$/.test(summary.day));

        if (cancelled) return;
        setDays(out);
        setStatus(`loaded ${out.filter((summary) => summary.any).length} logged days`);
      } catch (e: any) {
        if (cancelled) return;
        setDays([]);
        setStatus(`error: ${e?.message || String(e)}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const months = React.useMemo(() => {
    const byMonth = new Map<string, DaySummary[]>();
    for (const d of days) {
      const ym = String(d.day || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      const arr = byMonth.get(ym) || [];
      arr.push(d);
      byMonth.set(ym, arr);
    }

    const out: Array<{
      ym: string;
      label: string;
      days: DaySummary[];
      hitDates: Set<string>;
      anyDates: Set<string>;
      hitCount: number;
      anyCount: number;
      kcalAvg: number;
      proteinAvg: number;
    }> = [];

    for (const [ym, ds] of byMonth.entries()) {
      ds.sort((a, b) => b.day.localeCompare(a.day));
      const hitDates = new Set(ds.filter((x) => x.hit).map((x) => x.day));
      const anyDates = new Set(ds.filter((x: any) => x.any).map((x) => x.day));
      if (anyDates.size === 0) continue;
      const hitCount = ds.filter((x) => x.hit).length;
      const anyDays = ds.filter((x: any) => x.any);
      const denom = Math.max(1, anyDays.length);

      const kcalAvg = anyDays.reduce((acc, x) => acc + safeNum(x.kcal, 0), 0) / denom;
      const proteinAvg = anyDays.reduce((acc, x) => acc + safeNum(x.protein_g, 0), 0) / denom;

      out.push({
        ym,
        label: monthLabel(ym),
        days: ds,
        hitDates,
        anyDates,
        hitCount,
        kcalAvg,
        proteinAvg,
        anyCount: anyDays.length,
      });
    }

    out.sort((a, b) => b.ym.localeCompare(a.ym));
    return out;
  }, [days]);

  async function loadEntryServings(entry: any) {
    const foodId = String(entry?.my_food_id || "").trim();
    if (
      !foodId ||
      Object.prototype.hasOwnProperty.call(servingsByFoodId, foodId) ||
      servingsLoadingByFoodId[foodId]
    ) return;

    const seed = entryServingSeed(entry);
    if (seed.length) setServingsByFoodId((previous) => ({ ...previous, [foodId]: seed }));
    setServingsLoadingByFoodId((previous) => ({ ...previous, [foodId]: true }));
    try {
      const rows = (await fetchJson(
        `/api/lifeswitch/nutrition/my_foods/${encodeURIComponent(foodId)}/servings`
      )) as FoodServingOption[];
      const active = Array.isArray(rows) ? rows : [];
      const merged = [
        ...seed,
        ...active.filter((row) => !seed.some((item) => item.my_food_serving_id === row.my_food_serving_id)),
      ];
      setServingsByFoodId((previous) => ({ ...previous, [foodId]: merged }));
    } catch (e: any) {
      setEntrySaveError((previous) => ({
        ...previous,
        [String(entry?.nutrition_entry_id || "")]: String(e?.message || e),
      }));
    } finally {
      setServingsLoadingByFoodId((previous) => ({ ...previous, [foodId]: false }));
    }
  }

  async function saveEditedQuantity(
    day: string,
    nutrition_entry_id: string,
    selection: FoodQuantitySelection,
    servings: FoodServingOption[],
  ) {
    const quantity = Number(String(selection.quantity || "").trim());

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setEntrySaveError((prev) => ({ ...prev, [nutrition_entry_id]: "quantity must be greater than 0" }));
      return;
    }

    let payload: LogEntryQuantity;
    if (selection.unit === GRAMS_UNIT) {
      payload = { qty_g: quantity };
    } else {
      const serving = servings.find((row) => row.my_food_serving_id === selection.unit);
      if (!serving) {
        setEntrySaveError((prev) => ({ ...prev, [nutrition_entry_id]: "select an available serving unit" }));
        return;
      }
      payload = { my_food_serving_id: serving.my_food_serving_id, qty_servings: quantity };
    }

    setSavingEntryId(nutrition_entry_id);
    setSavedEntryId("");
    setEntrySaveError((prev) => {
      const next = { ...prev };
      delete next[nutrition_entry_id];
      return next;
    });

    try {
      await patchLogEntry(nutrition_entry_id, payload);
      await refreshOneDay(day, "");
      setEditQuantityByEntryId((previous) => {
        const next = { ...previous };
        delete next[nutrition_entry_id];
        return next;
      });
      setSavedEntryId(nutrition_entry_id);
      window.setTimeout(() => {
        setSavedEntryId((current) => (current === nutrition_entry_id ? "" : current));
      }, 1400);
    } catch (e: any) {
      setEntrySaveError((prev) => ({ ...prev, [nutrition_entry_id]: String(e?.message || e) }));
    } finally {
      setSavingEntryId((current) => (current === nutrition_entry_id ? "" : current));
    }
  }

  const isDelegatedView = Boolean(targetUserId);
  const showDebug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

  function openCalendarDay(day: string) {
    setExpandedDay(day);
    window.setTimeout(() => {
      document.getElementById(`nutrition-day-summary-${day}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div>
        <div className="text-lg font-semibold">Nutrition · Log</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Targets: {targetKcal != null ? `${targetKcal} kcal` : "no calorie target"} · {targetProteinG != null ? `${targetProteinG}g protein` : "no protein target"} · {targetStatus}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Status</div>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-full border border-emerald-500/30 bg-emerald-500/10" />
              Hit
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-full border border-amber-500/30 bg-amber-500/10" />
              Logged but not hit
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-full border border-muted/40" />
              No log
            </span>
          </div>
        </div>
      </div>

      {isDelegatedView ? (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          You are viewing {targetName || "this person"}’s nutrition log. This delegated view is read-only.
        </div>
      ) : null}

      {showDebug ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground">Debug</summary>
          <div className="mt-2 space-y-1 text-xs font-mono text-muted-foreground">
            <div>target: {targetUserId || "self"}</div>
            <div>status: {status}</div>
            <div>target status: {targetStatus}</div>
            <div>days: {days.length}</div>
            <div>months: {months.length}</div>
          </div>
        </details>
      ) : null}

      <div className="mt-8">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : months.length ? (
          months.map((m, idx) => (
            <section key={m.ym} className={idx ? "mt-10 pt-10 border-t border-muted/20" : ""}>
              <div className="text-base font-semibold">{m.label}</div>

              <div className="mt-4 grid grid-cols-[1fr_6.5rem] gap-2 items-start">
                <MonthCalendar
                  ym={m.ym}
                  hitDates={m.hitDates}
                  anyDates={m.anyDates}
                  today={today}
                  selectedDate={expandedDay}
                  onSelectDate={openCalendarDay}
                />

                <div className="flex justify-center">
                  <div className="w-[6.25rem] rounded-xl border border-muted/20 px-2 py-2 text-center">
                    <div className="text-sm font-semibold leading-none">{m.hitCount}</div>
                    <div className="mt-0.5 text-[9px] tracking-wide opacity-70">HIT DAYS</div>

                    <div className="mt-2 text-sm font-semibold leading-none">{formatK(m.anyCount)}</div>
                    <div className="mt-0.5 text-[9px] tracking-wide opacity-70">DAYS LOGGED</div>

                    <div className="mt-2 text-sm font-semibold leading-none">{fmt1tight(m.proteinAvg)}g</div>
                    <div className="mt-0.5 text-[9px] tracking-wide opacity-70">AVG PROTEIN</div>

                    <div className="mt-2 text-sm font-semibold leading-none">{fmt1tight(m.kcalAvg)}</div>
                    <div className="mt-0.5 text-[9px] tracking-wide opacity-70">AVG KCAL</div>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                {m.days.filter((d: any) => d.any).map((d, didx) => (
                  <div id={`nutrition-day-summary-${d.day}`} key={d.day} className={`scroll-mt-24 ${didx ? "mt-6 pt-6 border-t border-muted/20" : ""}`}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 text-left"
                      aria-expanded={expandedDay === d.day}
                      aria-controls={`nutrition-day-${d.day}`}
                      onClick={() => setExpandedDay((current) => current === d.day ? "" : d.day)}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-semibold">{d.day}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${d.hit
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          }`}>
                          {d.hit ? "Hit" : "Logged"}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground" aria-hidden="true">
                        {expandedDay === d.day ? "▴" : "▾"}
                      </span>
                    </button>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border border-muted/20 bg-background/40 px-3 py-2 text-xs">
                      <div className="flex items-baseline gap-2">
                        <div className="opacity-70">KCAL</div>
                        <div className="font-semibold">{fmt1tight(safeNum(d.kcal, 0))}</div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <div className="opacity-70">PROTEIN</div>
                        <div className="font-semibold">{fmt1tight(safeNum(d.protein_g, 0))}g</div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <div className="opacity-70">CARBS</div>
                        <div className="font-semibold">{fmt1tight(safeNum(d.carbs_g, 0))}g</div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <div className="opacity-70">FAT</div>
                        <div className="font-semibold">{fmt1tight(safeNum(d.fat_g, 0))}g</div>
                      </div>
                    </div>
                    {expandedDay === d.day ? (
                      Array.isArray(d.raw?.entries) && d.raw.entries.length ? (
                      <div id={`nutrition-day-${d.day}`} className="mt-4 rounded-xl border border-muted/20 overflow-hidden">
                        {(() => {
                          const entries = [...d.raw.entries];

                          // newest first by created_at (ISO sorts lexicographically)
                          entries.sort((a: any, b: any) => String(b?.created_at || "").localeCompare(String(a?.created_at || "")));

                          const fmtTime = (iso: any) => {
                            try {
                              const dt = new Date(String(iso));
                              return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                            } catch {
                              return "—";
                            }
                          };

                          let lastBucket = "";

                          return entries.map((e: any) => {
                            const label = String(e?.label || "").trim() || "—";
                            const qty = safeNum(e?.qty_g, 0);
                            const entryId = String(e?.nutrition_entry_id || "");
                            const foodId = String(e?.my_food_id || "").trim();
                            const currentQuantity = entryQuantitySelection(e);
                            const quantityDraft = editQuantityByEntryId[entryId] ?? currentQuantity;
                            const servingOptions = Object.prototype.hasOwnProperty.call(servingsByFoodId, foodId)
                              ? servingsByFoodId[foodId]
                              : entryServingSeed(e);
                            const draftNumber = Number(quantityDraft.quantity);
                            const currentNumber = Number(currentQuantity.quantity);
                            const quantityChanged =
                              !!entryId &&
                              Number.isFinite(draftNumber) &&
                              draftNumber > 0 &&
                              (quantityDraft.unit !== currentQuantity.unit || Math.abs(draftNumber - currentNumber) > 0.0001);
                            const m = entryMacros(e);

                            // bucket by minute so “submitted together” items cluster
                            const t = String(e?.created_at || "");
                            const bucket = t.length >= 16 ? t.slice(0, 16) : t; // YYYY-MM-DDTHH:MM
                            const showBucket = bucket && bucket !== lastBucket;
                            if (showBucket) lastBucket = bucket;

                            // identity line
                            const metaParts: string[] = [];
                            if (e?.food_brand) metaParts.push(String(e.food_brand));
                            if (e?.food_variant) metaParts.push(String(e.food_variant));
                            if (e?.food_source_type || e?.food_source_id) {
                              const st = e?.food_source_type ? String(e.food_source_type) : "";
                              const sid = e?.food_source_id ? String(e.food_source_id) : "";
                              metaParts.push(`${st}${sid ? ":" + sid : ""}`.replace(/^:/, ""));
                            }
                            const meta = metaParts.filter(Boolean).join(" · ");
                            const servingName = String(e?.serving_name || "").trim();
                            const servingQty = safeNum(e?.qty_servings, 0);
                            const quantityLabel = servingName && servingQty > 0
                              ? `${Math.abs(servingQty - 1) < 0.0001 ? servingName : `${fmt1tight(servingQty)} × ${servingName}`} · ${fmt1tight(qty)}g`
                              : qty > 0
                                ? `${fmt1tight(qty)}g`
                                : "";

                            return (
                              <div key={String(e.nutrition_entry_id)} className="px-3">
                                {showBucket ? (
                                  <div className="pt-3 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Logged {fmtTime(e?.created_at)}
                                  </div>
                                ) : null}

                                <div className="py-3 border-t border-muted/20">
                                  <div className="text-sm font-medium break-words whitespace-normal">{label}</div>

                                  {meta ? (
                                    <div className="mt-1 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
                                      {meta}
                                    </div>
                                  ) : null}

                                  <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    {/* left: macros */}
                                    <div className="min-w-0 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
                                      {quantityLabel ? `${quantityLabel} · ` : ""}
                                      kcal {fmt1tight(m.kcal)} · P {fmt1tight(m.p)} · C {fmt1tight(m.c)} · F {fmt1tight(m.f)}
                                    </div>

                                    {/* right: edit + delete */}
                                    <div className="w-full sm:w-auto sm:shrink-0">
                                      {isDelegatedView ? (
                                        <div className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
                                          Read-only
                                        </div>
                                      ) : (
                                          <details className="group w-full sm:w-auto">
                                            <summary
                                              className="ml-auto inline-flex list-none cursor-pointer select-none items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30 [&::-webkit-details-marker]:hidden"
                                              onClick={() => void loadEntryServings(e)}
                                            >
                                              Actions
                                              <span className="opacity-60 group-open:hidden">▾</span>
                                              <span className="hidden opacity-60 group-open:inline">▴</span>
                                            </summary>

                                            <div className="mt-2 grid w-full gap-2 sm:justify-items-end">
                                              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                                                {foodId ? (
                                                  <FoodQuantityControl
                                                    label={label}
                                                    value={quantityDraft}
                                                    servings={servingOptions}
                                                    onChange={(selection) => setEditQuantityByEntryId((previous) => ({
                                                      ...previous,
                                                      [entryId]: selection,
                                                    }))}
                                                    compact
                                                    disabled={savingEntryId === entryId}
                                                  />
                                                ) : (
                                                  <div className="text-xs text-muted-foreground">Meal entry quantity is read-only.</div>
                                                )}

                                                <button
                                                  className="rounded-md border px-2 py-1 text-xs hover:bg-muted/30 disabled:opacity-50"
                                                  onClick={() => void saveEditedQuantity(String(d.day), entryId, quantityDraft, servingOptions)}
                                                  disabled={!foodId || !entryId || !quantityChanged || savingEntryId === entryId}
                                                  title="Save quantity"
                                                >
                                                  {savingEntryId === entryId ? "Saving…" : "Save"}
                                                </button>

                                                {savedEntryId === entryId ? (
                                                  <div className="text-xs text-green-600">Saved</div>
                                                ) : null}

                                                {entrySaveError[entryId] ? (
                                                  <div className="text-xs text-red-600">{entrySaveError[entryId]}</div>
                                                ) : null}
                                                {foodId && servingsLoadingByFoodId[foodId] ? (
                                                  <div className="text-xs text-muted-foreground">Loading units…</div>
                                                ) : null}
                                              </div>

                                              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                                                <div className="text-[11px] font-semibold uppercase tracking-wide text-red-500">
                                                  Danger zone
                                                </div>
                                                <button
                                                  className="mt-2 rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-600 hover:bg-red-500/10"
                                                  onClick={() => {
                                                    if (!confirm("Delete this nutrition entry?")) return;
                                                    void deleteLogEntry(String(e.nutrition_entry_id))
                                                      .then(() => refreshOneDay(String(d.day), ""))
                                                      .catch(() => { });
                                                  }}
                                                  title="Delete entry"
                                                >
                                                  Delete entry
                                                </button>
                                              </div>
                                            </div>
                                          </details>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                      ) : (
                      <div className="mt-3 text-sm text-muted-foreground">No entries.</div>
                      )
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">No nutrition log data yet.</div>
        )}
      </div>
    </div>
  );
}
