"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
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
function daysInMonthUTC(year: number, month1: number) {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}
function firstDowUTC(year: number, month1: number) {
  return new Date(Date.UTC(year, month1 - 1, 1)).getUTCDay();
}
function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
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
  try { j = t ? JSON.parse(t) : null; } catch { }
  if (!r.ok) {
    const detail = j?.detail || j?.error || t?.slice(0, 200) || `HTTP ${r.status}`;
    throw new Error(String(detail));
  }
  return j;
}

type DaySummary = {
  day: string; // YYYY-MM-DD
  raw: any;    // backend payload (unknown shape for now)
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  hit: boolean;
};

function extractTotals(raw: any): { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null } {
  // Try common shapes; fall back to nulls.
  const candidates = [
    raw,
    raw?.totals,
    raw?.summary,
    raw?.day,
    raw?.data,
  ].filter(Boolean);

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
  return {
    kcal: kcal == null ? null : safeNum(kcal, 0),
    protein_g: protein_g == null ? null : safeNum(protein_g, 0),
    carbs_g: carbs_g == null ? null : safeNum(carbs_g, 0),
    fat_g: fat_g == null ? null : safeNum(fat_g, 0),
  };
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
        {DOW.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
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
  // Targets (v0 constants; later stored in Biometrics/Targets)
  const TARGET_PROTEIN_G = 180;
  const TARGET_KCAL = 2200;

  const [owner, setOwner] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("auth: loading…");
  const [days, setDays] = React.useState<DaySummary[]>([]);
  const [loading, setLoading] = React.useState(true);

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
        if (cancelled) return;
        setOwner(uid);
        setStatus("loading days…");

        // Fetch last 60 days (v0). Later: month-range endpoint.
        const N = 60;
        const base = new Date();
        const dayList: string[] = [];
        for (let i = 0; i < N; i++) {
          const d = new Date(base.getTime() - i * 24 * 3600 * 1000);
          const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
          dayList.push(iso);
        }
        dayList.sort((a, b) => b.localeCompare(a)); // newest first

        // Concurrency limit to avoid flooding
        const out: DaySummary[] = [];
        const chunkSize = 10;

        for (let i = 0; i < dayList.length; i += chunkSize) {
          const chunk = dayList.slice(i, i + chunkSize);
          const results = await Promise.all(
            chunk.map(async (day) => {
              const u = new URL("/api/lifeswitch/nutrition/log/day", window.location.origin);
              u.searchParams.set("owner_user_id", uid);
              u.searchParams.set("day", day);
              const raw = await fetchJson(u.toString());

              const t = extractTotals(raw);
              const protein_g = t.protein_g;
              const kcal = t.kcal;

              const hit =
                (protein_g != null ? protein_g >= TARGET_PROTEIN_G : false) &&
                (kcal != null ? kcal <= TARGET_KCAL : false);

              return { day, raw, ...t, hit } as DaySummary;
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
      kcalTotal: number;
      proteinTotal: number;
      carbsTotal: number;
      fatTotal: number;
    }> = [];

    for (const [ym, ds] of byMonth.entries()) {
      ds.sort((a, b) => b.day.localeCompare(a.day));
      const hitDates = new Set(ds.filter((x) => x.hit).map((x) => x.day));
      const anyDates = new Set(ds.filter((x) => (x.kcal ?? 0) > 0 || (x.protein_g ?? 0) > 0).map((x) => x.day));
      const hitCount = ds.filter((x) => x.hit).length;

      out.push({
        ym,
        label: monthLabel(ym),
        days: ds,
        hitDates,
        anyDates,
        hitCount,
        kcalTotal: ds.reduce((acc, x) => acc + safeNum(x.kcal, 0), 0),
        proteinTotal: ds.reduce((acc, x) => acc + safeNum(x.protein_g, 0), 0),
        carbsTotal: ds.reduce((acc, x) => acc + safeNum(x.carbs_g, 0), 0),
        fatTotal: ds.reduce((acc, x) => acc + safeNum(x.fat_g, 0), 0),
      });
    }

    out.sort((a, b) => b.ym.localeCompare(a.ym));
    return out;
  }, [days]);

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="text-lg font-semibold">Nutrition · Log</div>
      <div className="mt-1 text-sm text-muted-foreground break-words">
        Calendar + monthly totals. Hit = protein ≥ {TARGET_PROTEIN_G}g AND calories ≤ {TARGET_KCAL}.
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted-foreground">Debug</summary>
        <div className="mt-2 space-y-1 text-xs font-mono text-muted-foreground">
          <div>auth: {owner ? owner : "not signed in"}</div>
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

                    <div className="mt-2 text-sm font-semibold leading-none">{formatK(m.proteinTotal)}</div>
                    <div className="mt-0.5 text-[9px] tracking-wide opacity-70">PROTEIN g</div>

                    <div className="mt-2 text-sm font-semibold leading-none">{formatK(m.kcalTotal)}</div>
                    <div className="mt-0.5 text-[9px] tracking-wide opacity-70">KCAL</div>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                {m.days.slice(0, 20).map((d, didx) => (
                  <div key={d.day} className={didx ? "mt-6 pt-6 border-t border-muted/20" : ""}>
                    <div className="text-lg font-semibold">
                      {d.day} {d.hit ? "· HIT" : ""}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground break-words">
                      kcal={d.kcal ?? "—"} · protein={d.protein_g ?? "—"}g · carbs={d.carbs_g ?? "—"}g · fat={d.fat_g ?? "—"}g
                    </div>

                    {/* v0: show raw keys count so we can learn schema without browser-specific tooling */}
                    <div className="mt-1 text-xs text-muted-foreground">
                      raw_keys={d.raw && typeof d.raw === "object" ? Object.keys(d.raw).length : "?"}
                    </div>
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
