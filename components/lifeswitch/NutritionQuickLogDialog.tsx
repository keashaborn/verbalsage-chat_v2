"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";

type Meal = { meal_id: string; name: string; meal_type: string };

type MyFood = {
  my_food_id: string;
  display_name: string;
  brand: string | null;
  variant: string | null;
  kcal: number | null;       // per 100g
  protein_g: number | null;  // per 100g
  carbs_g: number | null;    // per 100g
  fat_g: number | null;      // per 100g
  is_active: boolean;
};

type LogEntry = {
  nutrition_entry_id: string;
  meal_id: string | null;
  my_food_id: string | null;
  qty_g: number | null;
  sort_order: number;
  label: string | null;
  meal_type: string | null;

  food_kcal_100g: number | null;
  food_protein_100g: number | null;
  food_carbs_100g: number | null;
  food_fat_100g: number | null;

  meal_kcal: number | null;
  meal_protein: number | null;
  meal_carbs: number | null;
  meal_fat: number | null;

  created_at: string;
};

type LogDayResp = { day: any | null; entries: LogEntry[] };

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetch(url, { cache: "no-store", ...(init || {}) });
  const t = await r.text();
  let j: any = null;
  try {
    j = t ? JSON.parse(t) : null;
  } catch {}
  if (!r.ok) {
    const detail = j?.detail || j?.error || t?.slice(0, 240) || `HTTP ${r.status}`;
    throw new Error(String(detail));
  }
  return j;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmt(n: number | null, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

function scaled(per100: number | null, qty_g: number | null) {
  if (per100 == null || qty_g == null) return null;
  return (per100 * qty_g) / 100.0;
}

function entryMacros(e: LogEntry) {
  if (e.meal_id) {
    const unknown =
      e.meal_kcal == null || e.meal_protein == null || e.meal_carbs == null || e.meal_fat == null;
    return { kcal: e.meal_kcal, p: e.meal_protein, c: e.meal_carbs, f: e.meal_fat, unknown };
  }
  const unknown =
    e.food_kcal_100g == null ||
    e.food_protein_100g == null ||
    e.food_carbs_100g == null ||
    e.food_fat_100g == null ||
    e.qty_g == null;
  return {
    kcal: scaled(e.food_kcal_100g, e.qty_g),
    p: scaled(e.food_protein_100g, e.qty_g),
    c: scaled(e.food_carbs_100g, e.qty_g),
    f: scaled(e.food_fat_100g, e.qty_g),
    unknown,
  };
}

export function NutritionQuickLogDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  const [owner, setOwner] = React.useState<string | null>(null);
  const [authErr, setAuthErr] = React.useState<string | null>(null);

  const [day, setDay] = React.useState<string>(todayISO());
  const [mode, setMode] = React.useState<"meal" | "food">("meal");

  const [meals, setMeals] = React.useState<Meal[]>([]);
  const [mealId, setMealId] = React.useState<string>("");

  const [foodQ, setFoodQ] = React.useState<string>("");
  const [foods, setFoods] = React.useState<MyFood[]>([]);
  const [qtyG, setQtyG] = React.useState<string>("100");

  const [loadingMeals, setLoadingMeals] = React.useState(false);
  const [loadingFoods, setLoadingFoods] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [err, setErr] = React.useState<string | null>(null);
  const [dayResp, setDayResp] = React.useState<LogDayResp | null>(null);

  const entries = dayResp?.entries || [];

  const dayTotals = React.useMemo(() => {
    let kcal = 0,
      p = 0,
      c = 0,
      f = 0;
    let any = false;
    let unknown = 0;
    for (const e of entries) {
      const m = entryMacros(e);
      if (m.unknown) unknown += 1;
      if (m.kcal != null) {
        kcal += m.kcal;
        any = true;
      }
      if (m.p != null) {
        p += m.p;
        any = true;
      }
      if (m.c != null) {
        c += m.c;
        any = true;
      }
      if (m.f != null) {
        f += m.f;
        any = true;
      }
    }
    return { kcal: any ? kcal : null, p: any ? p : null, c: any ? c : null, f: any ? f : null, unknown };
  }, [entries]);

  async function loadWhoami() {
    const j = await fetchJson("/api/auth/whoami");
    if (!j?.ok) {
      setOwner(null);
      setAuthErr(j?.error || "not signed in");
      return;
    }
    const sub = String(j.sub || "").trim();
    if (!sub) {
      setOwner(null);
      setAuthErr("missing sub");
      return;
    }
    setOwner(sub);
    setAuthErr(null);
  }

  async function loadMeals(uid: string) {
    setLoadingMeals(true);
    try {
      const j = (await fetchJson(`/api/lifeswitch/nutrition/meals?owner_user_id=${encodeURIComponent(uid)}`)) as any[];
      const rows: Meal[] = (Array.isArray(j) ? j : []).map((x) => ({
        meal_id: x.meal_id,
        name: x.name,
        meal_type: x.meal_type,
      }));
      setMeals(rows);
      if (!mealId && rows.length) setMealId(rows[0].meal_id);
    } finally {
      setLoadingMeals(false);
    }
  }

  async function loadDay(uid: string, d: string) {
    const j = (await fetchJson(
      `/api/lifeswitch/nutrition/log/day?owner_user_id=${encodeURIComponent(uid)}&day=${encodeURIComponent(d)}`
    )) as LogDayResp;
    setDayResp(j);
  }

  async function searchMyFoods(uid: string, q: string) {
    setLoadingFoods(true);
    try {
      const qs = new URLSearchParams({ owner_user_id: uid });
      const qq = q.trim();
      if (qq) qs.set("q", qq);
      const j = (await fetchJson(`/api/lifeswitch/nutrition/my_foods?${qs.toString()}`)) as any[];
      const rows: MyFood[] = (Array.isArray(j) ? j : []).filter((x) => x.is_active);
      setFoods(rows);
    } finally {
      setLoadingFoods(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setErr(null);
        await loadWhoami();
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open || !owner) return;
    (async () => {
      try {
        setErr(null);
        await loadMeals(owner);
        await loadDay(owner, day);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, owner]);

  React.useEffect(() => {
    if (!open || !owner) return;
    (async () => {
      try {
        await loadDay(owner, day);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  async function logMeal() {
    if (!owner) return;
    if (!mealId) {
      setErr("select a meal");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const sort = String(entries.length + 1);
      const qs = new URLSearchParams({
        owner_user_id: owner,
        day,
        meal_id: mealId,
        sort_order: sort,
      });
      await fetchJson(`/api/lifeswitch/nutrition/log/entry?${qs.toString()}`, { method: "POST" });
      await loadDay(owner, day);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function logFood(my_food_id: string) {
    if (!owner) return;
    const g = Number((qtyG || "0").trim());
    if (!Number.isFinite(g) || g <= 0) {
      setErr("qty_g must be > 0");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const sort = String(entries.length + 1);
      const qs = new URLSearchParams({
        owner_user_id: owner,
        day,
        my_food_id,
        qty_g: String(g),
        sort_order: sort,
      });
      await fetchJson(`/api/lifeswitch/nutrition/log/entry?${qs.toString()}`, { method: "POST" });
      await loadDay(owner, day);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9998] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[9999] w-[620px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-xl">
          <Dialog.Title className="px-4 pt-4 text-sm font-semibold">Quick Nutrition Log</Dialog.Title>
          <Dialog.Description className="px-4 pt-1 text-xs text-muted-foreground">
            Capture a repeat meal (template) or an ad-hoc food (from My Foods).
          </Dialog.Description>

          <div className="px-4 pt-3">
            {authErr ? <div className="rounded-md border p-2 text-xs">Auth: {authErr}</div> : null}
            {err ? <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900">{err}</div> : null}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted-foreground">Day</div>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </div>

              <div>
                <div className="text-xs text-muted-foreground">Mode</div>
                <div className="mt-1 flex gap-2">
                  <button className="w-full rounded-md border px-2 py-2 text-sm" onClick={() => setMode("meal")} disabled={mode === "meal"}>
                    Meal
                  </button>
                  <button className="w-full rounded-md border px-2 py-2 text-sm" onClick={() => setMode("food")} disabled={mode === "food"}>
                    Food
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-md border bg-muted/20 p-2 text-xs">
              Totals: kcal <span className="font-semibold">{fmt(dayTotals.kcal, 0)}</span> ·
              P <span className="font-semibold">{fmt(dayTotals.p, 0)}</span> ·
              C <span className="font-semibold">{fmt(dayTotals.c, 0)}</span> ·
              F <span className="font-semibold">{fmt(dayTotals.f, 0)}</span>
              {dayTotals.unknown ? <span className="ml-2 text-muted-foreground">(unknown: {dayTotals.unknown})</span> : null}
            </div>

            {mode === "meal" ? (
              <div className="mt-3">
                <div className="text-xs text-muted-foreground">Meal template</div>
                <div className="mt-1 flex gap-2">
                  <select
                    className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                    value={mealId}
                    onChange={(e) => setMealId(e.target.value)}
                    disabled={!owner || loadingMeals}
                  >
                    <option value="">(select)</option>
                    {meals.map((m) => (
                      <option key={m.meal_id} value={m.meal_id}>
                        {m.meal_type} · {m.name}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-md border px-3 py-2 text-sm" onClick={() => void loadMeals(owner!)} disabled={!owner || loadingMeals}>
                    {loadingMeals ? "…" : "Reload"}
                  </button>
                </div>

                <button className="mt-3 w-full rounded-md border px-3 py-2 text-sm" onClick={() => void logMeal()} disabled={!owner || saving}>
                  {saving ? "Logging…" : "Log Meal"}
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <div className="text-xs text-muted-foreground">My Foods search</div>
                <div className="mt-1 flex gap-2">
                  <input
                    className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                    value={foodQ}
                    onChange={(e) => setFoodQ(e.target.value)}
                    placeholder='e.g. "bread", "oats", "salmon", "96/4"'
                    disabled={!owner}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && owner) void searchMyFoods(owner, foodQ);
                    }}
                  />
                  <button className="rounded-md border px-3 py-2 text-sm" onClick={() => owner && void searchMyFoods(owner, foodQ)} disabled={!owner || loadingFoods}>
                    {loadingFoods ? "…" : "Search"}
                  </button>
                </div>

                <div className="mt-2">
                  <div className="text-xs text-muted-foreground">Grams</div>
                  <input
                    className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm"
                    value={qtyG}
                    onChange={(e) => setQtyG(e.target.value)}
                    placeholder="qty_g (e.g. 24, 40, 150)"
                    disabled={!owner}
                  />
                </div>

                <div className="mt-3 space-y-2">
                  {foods.slice(0, 12).map((f) => (
                    <div key={f.my_food_id} className="rounded-md border p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{f.display_name}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {f.brand ? f.brand : "—"}
                            {f.variant ? ` · ${f.variant}` : ""}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            per 100g: kcal {fmt(f.kcal, 0)} · P {fmt(f.protein_g, 1)} · C {fmt(f.carbs_g, 1)} · F {fmt(f.fat_g, 1)}
                          </div>
                        </div>
                        <button className="shrink-0 rounded-md border px-3 py-1.5 text-xs" onClick={() => void logFood(f.my_food_id)} disabled={!owner || saving}>
                          Log
                        </button>
                      </div>
                    </div>
                  ))}
                  {!loadingFoods && foods.length === 0 ? (
                    <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">Search My Foods, then click Log.</div>
                  ) : null}
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="text-xs font-semibold">Entries</div>
              <div className="mt-2 max-h-[220px] space-y-2 overflow-auto rounded-md border bg-muted/10 p-2">
                {entries.map((e) => {
                  const m = entryMacros(e);
                  return (
                    <div key={e.nutrition_entry_id} className="rounded-md border bg-background p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{e.label || "—"}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {e.meal_id ? "meal" : "food"} · sort {e.sort_order}
                            {e.qty_g != null ? ` · ${e.qty_g}g` : ""}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground">
                          kcal {fmt(m.kcal, 0)} · P {fmt(m.p, 0)} · C {fmt(m.c, 0)} · F {fmt(m.f, 0)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {entries.length === 0 ? <div className="text-xs text-muted-foreground">No entries for this day.</div> : null}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 px-4 pb-4 pt-3">
            <Dialog.Close asChild>
              <button className="rounded-md border px-3 py-2 text-sm">Close</button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
