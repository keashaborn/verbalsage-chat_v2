"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function pad2(n: number) { return n < 10 ? `0${n}` : String(n); }
function todayLocalYYYYMMDD() {
  const d = new Date();
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
function formatK(n: number) {
  const x = safeNum(n, 0);
  const abs = Math.abs(x);
  if (abs >= 1_000_000) return `${Math.round((x / 1_000_000) * 10) / 10}`.replace(/\.0$/, "") + "M";
  if (abs >= 1_000) return `${Math.round(x / 1_000)}K`;
  return String(Math.round(x));
}

async function fetchJson(url: string, init?: RequestInit) {
  const r = await authFetch(url, { cache: "no-store", ...(init || {}) });
  const t = await r.text().catch(() => "");
  let j: any = null;
  try { j = t ? JSON.parse(t) : null; } catch {}
  if (!r.ok) {
    const detail = j?.detail || j?.error || t?.slice(0, 200) || `HTTP ${r.status}`;
    throw new Error(String(detail));
  }
  return j;
}
async function patchLogEntry(owner_user_id: string, nutrition_entry_id: string, qty_g: number) {
  const u = new URL("/api/lifeswitch/nutrition/log/entry", window.location.origin);
  u.searchParams.set("owner_user_id", owner_user_id);
  u.searchParams.set("nutrition_entry_id", nutrition_entry_id);
  u.searchParams.set("qty_g", String(qty_g));

  const r = await authFetch(u.toString(), { method: "PATCH", cache: "no-store" });
  const t = await r.text().catch(() => "");
  let j: any = null;
  try { j = t ? JSON.parse(t) : null; } catch { }
  if (!r.ok) throw new Error(String(j?.detail || j?.error || t?.slice(0, 200) || `HTTP ${r.status}`));
  return j;
}

async function deleteLogEntry(owner_user_id: string, nutrition_entry_id: string) {
  const u = new URL("/api/lifeswitch/nutrition/log/entry", window.location.origin);
  u.searchParams.set("owner_user_id", owner_user_id);
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
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  hit: boolean;
};

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
function MonthCalendar(props: { ym: string; hitDates: Set<string>; anyDates: Set<string>; today: string }) {
  const { ym, hitDates, anyDates, today } = props;
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
            "h-7 flex items-center justify-center",
            hit ? "font-semibold" : hasAny ? "opacity-85" : "opacity-60",
            isToday ? "underline underline-offset-4" : "",
          ].join(" ");

          return <div key={date} className={cls}>{dayNum}</div>;
        })}
      </div>
    </div>
  );
}

export default function NutritionLogPage() {
  const TARGET_PROTEIN_G = 180;
  const TARGET_KCAL = 2200;

  const [owner, setOwner] = React.useState<string>("");
  const [targetUserId, setTargetUserId] = React.useState<string>("");
  const [targetName, setTargetName] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("auth: loading…");
  const [days, setDays] = React.useState<DaySummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editGramsByEntryId, setEditGramsByEntryId] = React.useState<Record<string, string>>({});
  const [savingEntryId, setSavingEntryId] = React.useState<string>("");
  const [savedEntryId, setSavedEntryId] = React.useState<string>("");
  const [entrySaveError, setEntrySaveError] = React.useState<Record<string, string>>({});
  async function refreshOneDay(uid: string, day: string, targetUid = targetUserId) {
    const u = new URL("/api/lifeswitch/nutrition/log/day", window.location.origin);
    u.searchParams.set("owner_user_id", uid);
    u.searchParams.set("day", day);
    if (targetUid) u.searchParams.set("target_user_id", targetUid);

    const raw = await fetchJson(u.toString());
    const t = extractTotals(raw);
    const any = hasAnyData(raw, t);

    const hit =
      any &&
      (t.protein_g != null ? t.protein_g >= TARGET_PROTEIN_G : false) &&
      (t.kcal != null ? t.kcal <= TARGET_KCAL : false);

    setDays((prev) =>
      (prev || []).map((x) => (x.day === day ? ({ ...x, raw, any, ...t, hit } as any) : x))
    );
  }

  const today = React.useMemo(() => todayLocalYYYYMMDD(), []);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setStatus("auth: loading…");

      try {
        const who = await fetchJson("/api/auth/whoami");
        if (!who?.ok || !String(who?.sub || "").trim()) {
          throw new Error(who?.error || "not signed in");
        }
        const uid = String(who.sub).trim();
        const params = new URLSearchParams(window.location.search);
        const targetUid = String(params.get("target_user_id") || "").trim();
        const targetLabel = String(params.get("target_name") || "").trim();

        if (cancelled) return;
        setOwner(uid);
        setTargetUserId(targetUid);
        setTargetName(targetLabel);
        setStatus(targetUid ? `loading ${targetLabel || "delegated"} nutrition…` : "loading days…");

        const N = 60;
        const base = new Date();
        const dayList: string[] = [];
        for (let i = 0; i < N; i++) {
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
              u.searchParams.set("owner_user_id", uid);
              u.searchParams.set("day", day);
              if (targetUid) u.searchParams.set("target_user_id", targetUid);
              const raw = await fetchJson(u.toString());
              const t = extractTotals(raw);

              const any = hasAnyData(raw, t);

              const hit =
                any &&
                (t.protein_g != null ? t.protein_g >= TARGET_PROTEIN_G : false) &&
                (t.kcal != null ? t.kcal <= TARGET_KCAL : false);

              return { day, raw, any, ...t, hit };
            })
          );
          out.push(...results);
          if (cancelled) return;
        }

        if (cancelled) return;
        setDays(out);
        setStatus(`loaded ${out.length} days`);
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

  async function saveEditedGrams(day: string, nutrition_entry_id: string, rawValue: string) {
    const grams = Number(String(rawValue || "").trim());

    if (!owner) {
      setEntrySaveError((prev) => ({ ...prev, [nutrition_entry_id]: "not signed in" }));
      return;
    }

    if (!Number.isFinite(grams) || grams <= 0) {
      setEntrySaveError((prev) => ({ ...prev, [nutrition_entry_id]: "grams must be > 0" }));
      return;
    }

    setSavingEntryId(nutrition_entry_id);
    setSavedEntryId("");
    setEntrySaveError((prev) => {
      const next = { ...prev };
      delete next[nutrition_entry_id];
      return next;
    });

    try {
      await patchLogEntry(owner, nutrition_entry_id, grams);
      await refreshOneDay(owner, day, "");
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

  return (
    <div className="mx-auto max-w-5xl p-4">
      {isDelegatedView ? (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          You are viewing {targetName || "this person"}’s nutrition log. This delegated view is read-only.
        </div>
      ) : null}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted-foreground">Debug</summary>
        <div className="mt-2 space-y-1 text-xs font-mono text-muted-foreground">
          <div>auth: {owner ? owner : "not signed in"}</div>
          <div>target: {targetUserId || "self"}</div>
          <div>status: {status}</div>
          <div>days: {days.length}</div>
          <div>months: {months.length}</div>
        </div>
      </details>

      <div className="mt-8">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : months.length ? (
          months.map((m, idx) => (
            <section key={m.ym} className={idx ? "mt-10 pt-10 border-t border-muted/20" : ""}>
              <div className="text-base font-semibold">{m.label}</div>

              <div className="mt-4 grid grid-cols-[1fr_6.5rem] gap-2 items-start">
                <MonthCalendar ym={m.ym} hitDates={m.hitDates} anyDates={m.anyDates} today={today} />

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
                {m.days.filter((d: any) => d.any).slice(0, 20).map((d, didx) => (
                  <div key={d.day} className={didx ? "mt-6 pt-6 border-t border-muted/20" : ""}>
                    <div className="text-lg font-semibold">
                      {d.day} {d.hit ? "· HIT" : ""}
                    </div>
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
                    {Array.isArray(d.raw?.entries) && d.raw.entries.length ? (
                      <div className="mt-4 rounded-xl border border-muted/20 overflow-hidden">
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
                            const gramsDraft = editGramsByEntryId[entryId] ?? String(qty || "");
                            const gramsChanged =
                              !!entryId &&
                              String(gramsDraft || "").trim() !== "" &&
                              Number(gramsDraft) !== qty;
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

                                  <div className="mt-2 flex items-center justify-between gap-3 min-w-0">
                                    {/* left: macros */}
                                    <div className="min-w-0 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
                                      {qty > 0 ? `${fmt1tight(qty)}g · ` : ""}
                                      kcal {fmt1tight(m.kcal)} · P {fmt1tight(m.p)} · C {fmt1tight(m.c)} · F {fmt1tight(m.f)}
                                    </div>

                                    {/* right: edit + delete */}
                                    <div className="shrink-0">
                                      {isDelegatedView ? (
                                        <div className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
                                          Read-only
                                        </div>
                                      ) : (
                                      <details className="group">
                                        <summary className="list-none cursor-pointer select-none rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30 opacity-70 hover:opacity-100 [&::-webkit-details-marker]:hidden">
                                          ⋯ <span className="opacity-60 group-open:hidden">▾</span><span className="opacity-60 hidden group-open:inline">▴</span>
                                        </summary>


                                        <div className="mt-2 flex flex-wrap items-center gap-2 justify-end">
                                          <input
                                            className="w-20 rounded-xl border bg-background px-2 py-1.5 text-xs text-right"
                                            value={gramsDraft}
                                            inputMode="decimal"
                                            onChange={(ev) => {
                                              const value = ev.currentTarget.value;
                                              setEditGramsByEntryId((prev) => ({
                                                ...prev,
                                                [entryId]: value,
                                              }));
                                            }}
                                            onKeyDown={(ev) => {
                                              if (ev.key !== "Enter") return;
                                              const value = ev.currentTarget.value;
                                              void saveEditedGrams(String(d.day), entryId, value);
                                            }}
                                            title="Edit grams, then Save"
                                          />
                                          <div className="text-xs text-muted-foreground">g</div>

                                          <button
                                            className="rounded-md border px-2 py-1 text-xs hover:bg-muted/30 disabled:opacity-50"
                                            onClick={() => void saveEditedGrams(String(d.day), entryId, gramsDraft)}
                                            disabled={!entryId || !gramsChanged || savingEntryId === entryId}
                                            title="Save grams"
                                          >
                                            {savingEntryId === entryId ? "Saving…" : "Save"}
                                          </button>

                                          {savedEntryId === entryId ? (
                                            <div className="text-xs text-green-600">Saved</div>
                                          ) : null}

                                          {entrySaveError[entryId] ? (
                                            <div className="text-xs text-red-600">{entrySaveError[entryId]}</div>
                                          ) : null}

                                          <button
                                            className="rounded-md border px-2 py-1 text-xs hover:bg-muted/30"
                                            onClick={() => {
                                              if (!confirm("Delete this entry?")) return;
                                              void deleteLogEntry(owner, String(e.nutrition_entry_id))
                                                .then(() => refreshOneDay(owner, String(d.day), ""))
                                                .catch(() => { });
                                            }}
                                            title="Delete entry"
                                          >
                                            Delete
                                          </button>
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
                    )}
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
