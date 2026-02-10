"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type FoodOverride = {
  alias?: string;
  default_grams?: number;
};

type MyFood = {
  my_food_id: string;
  owner_user_id: string;

  display_name: string;
  brand: string | null;
  variant: string | null;

  source_type: string;
  source_id: string | null;

  // per 100g
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;

  is_active: boolean;
};

type LogEntry = {
  nutrition_entry_id: string;
  my_food_id: string | null;
  meal_id: string | null;
  qty_g: number | null;
  sort_order: number | null;

  label: string | null;
  food_kcal_100g: number | null;
  food_protein_100g: number | null;
  food_carbs_100g: number | null;
  food_fat_100g: number | null;

  meal_kcal: number | null;
  meal_protein: number | null;
  meal_carbs: number | null;
  meal_fat: number | null;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function safeNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function fmt0(x: number | null) {
  if (x == null) return "—";
  return String(Math.round(x));
}

function fmt1(x: number | null) {
  if (x == null) return "—";
  return (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, "");
}

function loadFoodOverrides(): Record<string, FoodOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("vs_food_overrides_v1");
    const j = raw ? JSON.parse(raw) : {};
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

export default function NutritionCapturePage() {
  const [owner, setOwner] = React.useState<string | null>(null);
  const [authErr, setAuthErr] = React.useState<string | null>(null);
  const router = useRouter();
  const [flash, setFlash] = React.useState<string>("");

  const [day, setDay] = React.useState<string>(todayISO());

  const [foods, setFoods] = React.useState<MyFood[]>([]);
  const [foodsLoading, setFoodsLoading] = React.useState(false);
  const [foodsErr, setFoodsErr] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const [gramsByFood, setGramsByFood] = React.useState<Record<string, string>>({});

  const [log, setLog] = React.useState<{ entries: LogEntry[] } | null>(null);
  const [logLoading, setLogLoading] = React.useState(false);
  const [logErr, setLogErr] = React.useState<string | null>(null);

  const [status, setStatus] = React.useState<string>("");

  // auth
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/whoami", { cache: "no-store" });
        const j = await r.json().catch(() => null);
        if (!j?.ok) {
          setOwner(null);
          setAuthErr(j?.error || "not signed in");
          return;
        }
        const sub = String(j.sub || "").trim();
        if (!sub) throw new Error("missing sub");
        setOwner(sub);
        setAuthErr(null);
      } catch (e: any) {
        setOwner(null);
        setAuthErr(String(e?.message || e));
      }
    })();
  }, []);

  const overrides = React.useMemo(() => loadFoodOverrides(), [owner]); // reload on sign-in change

  async function loadFoods() {
    if (!owner) return;
    setFoodsLoading(true);
    setFoodsErr(null);
    try {
      const p = new URLSearchParams({ owner_user_id: owner });
      const qq = q.trim();
      if (qq) p.set("q", qq);

      const r = await fetch(`/api/lifeswitch/nutrition/my_foods?${p.toString()}`, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(t.slice(0, 200) || `HTTP ${r.status}`);
      const j = JSON.parse(t);
      const list: MyFood[] = Array.isArray(j) ? j : [];
      const active = list.filter((x) => x && x.is_active);

      // stable ordering: override alias/display_name asc
      active.sort((a, b) => {
        const ao = overrides[a.my_food_id]?.alias?.trim() || a.display_name;
        const bo = overrides[b.my_food_id]?.alias?.trim() || b.display_name;
        return ao.localeCompare(bo);
      });

      setFoods(active);

      // initialize grams inputs from overrides (only if unset)
      setGramsByFood((prev) => {
        const next = { ...(prev || {}) };
        for (const f of active) {
          if (next[f.my_food_id] != null && String(next[f.my_food_id]).trim() !== "") continue;
          const g = overrides[f.my_food_id]?.default_grams;
          if (g && Number.isFinite(g)) next[f.my_food_id] = String(g);
        }
        return next;
      });
    } catch (e: any) {
      setFoods([]);
      setFoodsErr(String(e?.message || e));
    } finally {
      setFoodsLoading(false);
    }
  }

  async function loadDay() {
    if (!owner) return;
    setLogLoading(true);
    setLogErr(null);
    try {
      const url = `/api/lifeswitch/nutrition/log/day?owner_user_id=${encodeURIComponent(owner)}&day=${encodeURIComponent(day)}`;
      const r = await fetch(url, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(t.slice(0, 200) || `HTTP ${r.status}`);
      const j = JSON.parse(t);
      setLog({ entries: Array.isArray(j?.entries) ? j.entries : [] });
    } catch (e: any) {
      setLog(null);
      setLogErr(String(e?.message || e));
    } finally {
      setLogLoading(false);
    }
  }

  React.useEffect(() => {
    if (!owner) return;
    void loadFoods();
  }, [owner]);

  React.useEffect(() => {
    if (!owner) return;
    void loadDay();
  }, [owner, day]);

  const totals = React.useMemo(() => {
    const entries = log?.entries || [];
    let kcal = 0, p = 0, c = 0, f = 0;

    for (const e of entries) {
      const qty = safeNum(e.qty_g);
      if (qty == null) continue;

      // food entry
      if (e.my_food_id) {
        const k100 = safeNum(e.food_kcal_100g);
        const p100 = safeNum(e.food_protein_100g);
        const c100 = safeNum(e.food_carbs_100g);
        const f100 = safeNum(e.food_fat_100g);
        if (k100 != null) kcal += (k100 * qty) / 100.0;
        if (p100 != null) p += (p100 * qty) / 100.0;
        if (c100 != null) c += (c100 * qty) / 100.0;
        if (f100 != null) f += (f100 * qty) / 100.0;
      }

      // meal entry (already aggregated by backend)
      if (e.meal_id) {
        const mk = safeNum(e.meal_kcal);
        const mp = safeNum(e.meal_protein);
        const mc = safeNum(e.meal_carbs);
        const mf = safeNum(e.meal_fat);
        if (mk != null) kcal += mk;
        if (mp != null) p += mp;
        if (mc != null) c += mc;
        if (mf != null) f += mf;
      }
    }
    return { kcal, p, c, f };
  }, [log]);

  async function logFood(my_food_id: string) {
    if (!owner) return;
    setStatus("");
    try {
      const g = Number((gramsByFood[my_food_id] || "").trim());
      if (!Number.isFinite(g) || g <= 0) throw new Error("grams must be > 0");

      const nextSort = ((log?.entries?.length || 0) + 1) * 10;

      const qs = new URLSearchParams({
        owner_user_id: owner,
        day,
        my_food_id,
        qty_g: String(g),
        sort_order: String(nextSort),
      });

      const r = await fetch(`/api/lifeswitch/nutrition/log/entry?${qs.toString()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        cache: "no-store",
      });

      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(t.slice(0, 200) || `HTTP ${r.status}`);

      setStatus("logged");
      const label = foods.find((x) => x.my_food_id === my_food_id)?.display_name || "Food";
      setFlash(`Logged: ${label} · ${g}g`);
      window.setTimeout(() => setFlash(""), 1500);
      await loadDay();
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

  async function patchEntryQty(nutrition_entry_id: string, qty_g: number) {
    if (!owner) return;
    setStatus("");
    try {
      const qs = new URLSearchParams({
        owner_user_id: owner,
        nutrition_entry_id,
        qty_g: String(qty_g),
      });
      const r = await fetch(`/api/lifeswitch/nutrition/log/entry?${qs.toString()}`, { method: "PATCH", cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(t.slice(0, 200) || `HTTP ${r.status}`);
      setStatus("updated");
      await loadDay();
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 overflow-x-hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold">Nutrition · Capture</div>
          <div className="mt-1 text-xs text-muted-foreground break-words whitespace-normal">
            Tap a food, adjust grams if needed, then log.
          </div>
        </div>

        <div className="shrink-0">
          <input
            className="rounded-xl border bg-background px-3 py-2 text-sm"
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
      </div>
      {flash ? (
        <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium">
          {flash}
        </div>
      ) : null}
      {authErr && !owner ? (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
          {authErr}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border p-3">
        <div className="text-sm font-semibold">Totals</div>
        <div className="mt-2 text-sm text-muted-foreground break-words whitespace-normal">
          kcal {fmt0(totals.kcal)} · P {fmt1(totals.p)}g · C {fmt1(totals.c)}g · F {fmt1(totals.f)}g
        </div>
        {logErr ? <div className="mt-2 text-xs text-red-500">{logErr}</div> : null}
      </div>

      <div className="mt-4 grid gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <input
            className="flex-1 min-w-0 rounded-xl border bg-background px-3 py-2 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="filter foods (optional)"
            onKeyDown={(e) => {
              if (e.key === "Enter") void loadFoods();
            }}
          />
          <button
            className="shrink-0 rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
            onClick={() => void loadFoods()}
            disabled={!owner || foodsLoading}
          >
            {foodsLoading ? "…" : "Refresh"}
          </button>
        </div>

        {foodsErr ? <div className="text-xs text-red-500">{foodsErr}</div> : null}
        {status ? <div className="text-xs text-muted-foreground">{status}</div> : null}

        <div className="divide-y divide-muted/20 rounded-xl border">
          {foods.map((f) => {
            const ov = overrides[f.my_food_id] || {};
            const label = (ov.alias && ov.alias.trim()) ? ov.alias.trim() : f.display_name;
            const grams = gramsByFood[f.my_food_id] ?? "";

            return (
              <div key={f.my_food_id} className="py-3 px-3 flex items-start justify-between gap-3 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium break-words whitespace-normal">{label}</div>
                  <div className="mt-1 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
                    {f.brand ? f.brand : "—"}
                    {f.variant ? ` · ${f.variant}` : ""}
                    {f.source_type ? ` · ${f.source_type}` : ""}
                    {f.source_id ? `:${f.source_id}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
                    kcal/100g {fmt0(f.kcal)} · P {fmt1(f.protein_g)} · C {fmt1(f.carbs_g)} · F {fmt1(f.fat_g)}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  <input
                    className="w-24 rounded-xl border bg-background px-2 py-1.5 text-sm text-right"
                    value={grams}
                    onChange={(e) => setGramsByFood((p) => ({ ...(p || {}), [f.my_food_id]: e.target.value }))}
                    inputMode="decimal"
                    placeholder="g"
                  />
                  <button
                    className="w-24 rounded-xl border px-3 py-1.5 text-sm hover:bg-muted/30 disabled:opacity-50"
                    onClick={() => void logFood(f.my_food_id)}
                    disabled={!owner}
                  >
                    Log
                  </button>
                </div>
              </div>
            );
          })}
          {!foods.length ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">No foods.</div>
          ) : null}
        </div>
      </div>

      {/* Today entries (edit grams inline) */}
      <div className="mt-6 rounded-xl border p-3">
        <div className="text-sm font-semibold">Today</div>
        {logLoading ? <div className="mt-2 text-sm text-muted-foreground">loading…</div> : null}

        <div className="mt-2 divide-y divide-muted/20">
          {(log?.entries || []).map((e) => {
            const isFood = !!e.my_food_id;
            const label = e.label || (isFood ? "food" : "combo");
            const qty = safeNum(e.qty_g) ?? 0;
            return (
              <div key={e.nutrition_entry_id} className="py-3 flex items-center justify-between gap-3 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium break-words whitespace-normal">{label}</div>
                </div>

                {isFood ? (
                  <div className="shrink-0 flex items-center gap-2">
                    <input
                      className="w-20 rounded-xl border bg-background px-2 py-1.5 text-sm text-right"
                      defaultValue={String(qty)}
                      inputMode="decimal"
                      onKeyDown={(ev) => {
                        if (ev.key !== "Enter") return;
                        const v = Number((ev.currentTarget.value || "").trim());
                        if (Number.isFinite(v) && v > 0) void patchEntryQty(e.nutrition_entry_id, v);
                      }}
                      title="Enter to update"
                    />
                    <div className="text-xs text-muted-foreground">g</div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {!(log?.entries || []).length ? (
            <div className="py-3 text-sm text-muted-foreground">No entries.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
