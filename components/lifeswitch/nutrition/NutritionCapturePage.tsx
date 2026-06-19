"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";

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

  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;

  is_active: boolean;
};

type MealCombo = {
  meal_id: string;
  owner_user_id: string;
  name: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack" | "other";
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type MealComboItem = {
  meal_item_id: string;
  meal_id: string;
  my_food_id: string;

  qty_g: number | null;
  my_food_serving_id: string | null;
  qty_servings: number | null;
  qty_g_resolved: number | null;

  serving_name: string | null;
  serving_grams: number | null;

  sort_order: number;
  notes: string | null;

  display_name: string;
  brand: string | null;
  variant: string | null;

  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

type CaptureMode = "foods" | "meals";

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function todayLocalYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function safeNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function fmt(n: number | null, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

function scaled(per100: number | null, grams: number | null): number | null {
  if (per100 == null || grams == null) return null;
  return (per100 * grams) / 100;
}

function resolvedItemGrams(item: MealComboItem): number | null {
  return item.qty_g_resolved ?? item.qty_g;
}

async function fetchJson(url: string, init?: RequestInit) {
  const r = await authFetch(url, { cache: "no-store", ...(init || {}) });
  const t = await r.text();

  let j: any = null;
  try {
    j = t ? JSON.parse(t) : null;
  } catch {
    j = null;
  }

  if (!r.ok) {
    const detail = j?.detail || j?.error || t?.slice(0, 250) || `HTTP ${r.status}`;
    throw new Error(String(detail));
  }

  return j;
}


type OverrideRow = {
  owner_user_id: string;
  my_food_id: string;
  alias: string | null;
  default_grams: number | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

async function fetchOverridesFromDb(owner_user_id: string): Promise<Record<string, FoodOverride>> {
  const qs = new URLSearchParams({ owner_user_id });
  const rows = (await fetchJson(`/api/lifeswitch/nutrition/my_food_overrides?${qs.toString()}`)) as OverrideRow[];

  const out: Record<string, FoodOverride> = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const fid = String(row?.my_food_id || "").trim();
    if (!fid) continue;

    out[fid] = {
      alias: row?.alias ? String(row.alias) : undefined,
      default_grams: row?.default_grams != null ? Number(row.default_grams) : undefined,
    };
  }

  return out;
}

export default function NutritionCapturePage() {
  const [owner, setOwner] = React.useState<string | null>(null);
  const [authErr, setAuthErr] = React.useState<string | null>(null);

  const [mode, setMode] = React.useState<CaptureMode>("foods");

  const [foods, setFoods] = React.useState<MyFood[]>([]);
  const [foodsLoading, setFoodsLoading] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [gramsByFood, setGramsByFood] = React.useState<Record<string, string>>({});

  const [meals, setMeals] = React.useState<MealCombo[]>([]);
  const [mealsLoading, setMealsLoading] = React.useState(false);
  const [selectedMealId, setSelectedMealId] = React.useState<string>("");
  const [mealItems, setMealItems] = React.useState<MealComboItem[]>([]);
  const [mealItemsLoading, setMealItemsLoading] = React.useState(false);
  const [gramsByMealItem, setGramsByMealItem] = React.useState<Record<string, string>>({});
  const [includedMealItemIds, setIncludedMealItemIds] = React.useState<Record<string, boolean>>({});

  const [overrides, setOverrides] = React.useState<Record<string, FoodOverride>>({});

  const [day, setDay] = React.useState<string>(todayLocalYYYYMMDD());
  const [status, setStatus] = React.useState<string>("");
  const [flash, setFlash] = React.useState<string>("");

  const selectedMeal = React.useMemo(() => {
    return meals.find((m) => m.meal_id === selectedMealId) || null;
  }, [meals, selectedMealId]);

  const mealTotals = React.useMemo(() => {
    const sum = (k: "kcal" | "protein_g" | "carbs_g" | "fat_g") => {
      let total = 0;
      let any = false;

      for (const item of mealItems) {
        if (includedMealItemIds[item.meal_item_id] === false) continue;

        const grams = gramsByMealItem[item.meal_item_id]
          ? Number(gramsByMealItem[item.meal_item_id])
          : resolvedItemGrams(item);

        const v = scaled((item as any)[k], Number.isFinite(Number(grams)) ? Number(grams) : null);
        if (v == null) continue;

        total += v;
        any = true;
      }

      return any ? total : null;
    };

    return {
      kcal: sum("kcal"),
      protein_g: sum("protein_g"),
      carbs_g: sum("carbs_g"),
      fat_g: sum("fat_g"),
    };
  }, [mealItems, gramsByMealItem, includedMealItemIds]);

  // ----------------------------
  // AUTH
  // ----------------------------
  React.useEffect(() => {
    (async () => {
      try {
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
      } catch (e: any) {
        setOwner(null);
        setAuthErr(String(e?.message || e));
      }
    })();
  }, []);

  // ----------------------------
  // LOAD FOODS
  // ----------------------------
  async function loadFoods() {
    if (!owner) return;

    setFoodsLoading(true);
    setStatus("");

    try {
      const p = new URLSearchParams({ owner_user_id: owner });
      if (q.trim()) p.set("q", q.trim());

      const list = (await fetchJson(`/api/lifeswitch/nutrition/my_foods?${p.toString()}`)) as MyFood[];
      const active = Array.isArray(list) ? list.filter((x) => x?.is_active) : [];

      setFoods(active);
    } catch (e: any) {
      setFoods([]);
      setStatus(String(e?.message || e));
    } finally {
      setFoodsLoading(false);
    }
  }

  // ----------------------------
  // LOAD MEAL COMBOS
  // ----------------------------
  async function loadMeals() {
    if (!owner) return;

    setMealsLoading(true);
    setStatus("");

    try {
      const p = new URLSearchParams({ owner_user_id: owner });
      const list = (await fetchJson(`/api/lifeswitch/nutrition/meals?${p.toString()}`)) as MealCombo[];
      const active = Array.isArray(list) ? list.filter((x) => x?.is_active) : [];

      setMeals(active);

      if (!selectedMealId && active.length > 0) {
        setSelectedMealId(active[0].meal_id);
      }
    } catch (e: any) {
      setMeals([]);
      setStatus(String(e?.message || e));
    } finally {
      setMealsLoading(false);
    }
  }

  async function loadMealItems(mealId: string) {
    if (!mealId) {
      setMealItems([]);
      setIncludedMealItemIds({});
      return;
    }

    setMealItemsLoading(true);
    setStatus("");

    try {
      const list = (await fetchJson(
        `/api/lifeswitch/nutrition/meals/${encodeURIComponent(mealId)}/items`
      )) as MealComboItem[];

      const sorted = Array.isArray(list)
        ? [...list].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
        : [];

      setMealItems(sorted);
      setIncludedMealItemIds(
        Object.fromEntries(sorted.map((item) => [item.meal_item_id, true]))
      );
    } catch (e: any) {
      setMealItems([]);
      setIncludedMealItemIds({});
      setStatus(String(e?.message || e));
    } finally {
      setMealItemsLoading(false);
    }
  }

  React.useEffect(() => {
    if (!owner) return;

    void (async () => {
      try {
        const db = await fetchOverridesFromDb(owner);
        setOverrides(db);
      } catch {
        setOverrides({});
      }
    })();

    void loadFoods();
    void loadMeals();
  }, [owner]);

  React.useEffect(() => {
    if (!selectedMealId) {
      setMealItems([]);
      setIncludedMealItemIds({});
      return;
    }

    void loadMealItems(selectedMealId);
  }, [selectedMealId]);


  React.useEffect(() => {
    if (!foods.length) return;

    setGramsByFood((prev) => {
      const next = { ...prev };

      for (const f of foods) {
        const id = String(f?.my_food_id || "").trim();
        if (!id) continue;
        if (String(next[id] || "").trim()) continue;

        const g = overrides[id]?.default_grams;
        if (g != null && Number.isFinite(Number(g)) && Number(g) > 0) {
          next[id] = String(g);
        }
      }

      return next;
    });
  }, [foods, overrides]);

  // ----------------------------
  // LOG (ATOMIC)
  // ----------------------------
  async function logFood(my_food_id: string, grams: number) {
    if (!owner) throw new Error("not signed in");

    if (!Number.isFinite(grams) || grams <= 0) {
      throw new Error("grams must be greater than 0");
    }

    const r = await authFetch("/api/lifeswitch/nutrition/log/entry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        owner_user_id: owner,
        day,
        my_food_id,
        qty_g: grams,
        sort_order: 1,
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      throw new Error(t);
    }
  }

  async function logSingleFood(f: MyFood) {
    try {
      setStatus("");

      const grams = Number(gramsByFood[f.my_food_id] || 0);
      await logFood(f.my_food_id, grams);

      setFlash(`Logged ${overrides[f.my_food_id]?.alias || f.display_name}`);
      setTimeout(() => setFlash(""), 1200);
    } catch (e: any) {
      setStatus(String(e?.message || e));
    }
  }

  async function logMealCombo() {
    if (!selectedMeal) {
      setStatus("select a meal");
      return;
    }

    if (!mealItems.length) {
      setStatus("selected meal has no foods");
      return;
    }

    try {
      const selectedItems = mealItems.filter((item) => includedMealItemIds[item.meal_item_id] !== false);

      if (selectedItems.length === 0) {
        setStatus("no selected rows to log");
        return;
      }

      setStatus(`logging ${selectedMeal.name}...`);

      let count = 0;

      for (const item of selectedItems) {
        if (includedMealItemIds[item.meal_item_id] === false) continue;

        const grams = gramsByMealItem[item.meal_item_id]
          ? Number(gramsByMealItem[item.meal_item_id])
          : resolvedItemGrams(item);

        if (!Number.isFinite(Number(grams)) || Number(grams) <= 0) {
          continue;
        }

        await logFood(item.my_food_id, Number(grams));
        count += 1;
      }

      if (count === 0) {
        setStatus("no valid rows to log");
        return;
      }

      setFlash(`Logged ${selectedMeal.name} (${count} foods)`);
      setTimeout(() => setFlash(""), 1200);
      setStatus("");
    } catch (e: any) {
      setStatus(String(e?.message || e));
    }
  }

  // ----------------------------
  // UI
  // ----------------------------
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="flex justify-between items-center gap-3">
        <div>
          <div className="text-lg font-semibold">Nutrition · Capture</div>
          <div className="text-xs text-muted-foreground">
            Individual foods or meals. All writes remain atomic.
          </div>
        </div>

        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
      </div>

      {authErr && <div className="mt-3 text-sm text-red-500">{authErr}</div>}

      {flash && <div className="mt-3 text-sm text-green-600">{flash}</div>}

      <div className="mt-4 flex gap-2">
        <button
          className={`rounded border px-3 py-1 text-sm ${mode === "foods" ? "bg-muted" : ""}`}
          onClick={() => setMode("foods")}
        >
          Individual Foods
        </button>

        <button
          className={`rounded border px-3 py-1 text-sm ${mode === "meals" ? "bg-muted" : ""}`}
          onClick={() => setMode("meals")}
        >
          Meals
        </button>
      </div>

      {mode === "meals" && (
        <div className="mt-4 border rounded p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Meals</div>
              <div className="text-xs text-muted-foreground">
                Select a meal, edit grams if needed, then log all rows.
              </div>
            </div>

            <button
              className="border rounded px-3 py-1 text-sm"
              onClick={() => void loadMeals()}
              disabled={mealsLoading}
            >
              {mealsLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <select
            className="mt-3 w-full border rounded px-2 py-1 text-sm"
            value={selectedMealId}
            onChange={(e) => setSelectedMealId(e.target.value)}
          >
            <option value="">Select meal</option>
            {meals.map((m) => (
              <option key={m.meal_id} value={m.meal_id}>
                {m.name} · {m.meal_type}
              </option>
            ))}
          </select>

          {selectedMeal && (
            <div className="mt-3 rounded border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{selectedMeal.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {mealItems.length} foods · kcal {fmt(mealTotals.kcal)} · P {fmt(mealTotals.protein_g)}g · C{" "}
                    {fmt(mealTotals.carbs_g)}g · F {fmt(mealTotals.fat_g)}g
                  </div>
                </div>

                <button
                  className="border rounded px-3 py-1 text-sm"
                  onClick={() => void logMealCombo()}
                  disabled={mealItemsLoading || mealItems.length === 0}
                >
                  Log Selected
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {mealItemsLoading && (
                  <div className="text-xs text-muted-foreground">Loading meal foods...</div>
                )}

                {!mealItemsLoading &&
                  mealItems.map((item) => {
                    const grams =
                      gramsByMealItem[item.meal_item_id] ?? String(resolvedItemGrams(item) ?? "");

                    const gramsNum = Number(grams);
                    const rowKcal = Number.isFinite(gramsNum) ? scaled(item.kcal, gramsNum) : null;
                    const rowProtein = Number.isFinite(gramsNum) ? scaled(item.protein_g, gramsNum) : null;

                    const included = includedMealItemIds[item.meal_item_id] !== false;

                    return (
                      <div
                        key={item.meal_item_id}
                        className={`border rounded p-2 flex justify-between gap-3 ${included ? "" : "opacity-50"}`}
                      >
                        <label className="flex min-w-0 flex-1 items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={included}
                            onChange={(e) =>
                              setIncludedMealItemIds((p) => ({
                                ...p,
                                [item.meal_item_id]: e.target.checked,
                              }))
                            }
                          />

                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{item.display_name}</div>
                            <div className="text-xs text-muted-foreground">
                              kcal {fmt(rowKcal)} · P {fmt(rowProtein)}g
                            </div>
                          </div>
                        </label>

                        <div className="flex items-center gap-2">
                          <input
                            className="w-20 border rounded px-2 py-1 text-sm text-right"
                            value={grams}
                            onChange={(e) =>
                              setGramsByMealItem((p) => ({
                                ...p,
                                [item.meal_item_id]: e.target.value,
                              }))
                            }
                          />

                          <button
                            className="border rounded px-2 py-1 text-sm"
                            onClick={() =>
                              void (async () => {
                                try {
                                  await logFood(item.my_food_id, Number(grams));
                                  setFlash(`Logged ${item.display_name}`);
                                  setTimeout(() => setFlash(""), 1200);
                                } catch (e: any) {
                                  setStatus(String(e?.message || e));
                                }
                              })()
                            }
                          >
                            Log
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {!mealItemsLoading && selectedMeal && mealItems.length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    This meal has no foods yet. Add foods in Library / Meals.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "foods" && (
        <div className="mt-4">
          <div className="text-sm font-semibold">Individual Foods</div>

          <input
            className="mt-2 border rounded px-2 py-1 w-full text-sm"
            placeholder="search foods"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <button
            className="mt-2 border rounded px-3 py-1 text-sm"
            onClick={() => void loadFoods()}
            disabled={foodsLoading}
          >
            {foodsLoading ? "Loading..." : "Refresh"}
          </button>

          <div className="mt-3 space-y-2">
            {foods.map((f) => (
              <div key={f.my_food_id} className="border rounded p-2 flex justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">
                    {overrides[f.my_food_id]?.alias || f.display_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    P {safeNum(f.protein_g)}g · C {safeNum(f.carbs_g)}g · F {safeNum(f.fat_g)}g
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <input
                    className="w-20 border rounded px-2 py-1 text-sm text-right"
                    value={gramsByFood[f.my_food_id] || ""}
                    onChange={(e) =>
                      setGramsByFood((p) => ({
                        ...p,
                        [f.my_food_id]: e.target.value,
                      }))
                    }
                  />

                  <button
                    className="border rounded px-2 py-1 text-sm"
                    onClick={() => void logSingleFood(f)}
                  >
                    Log
                  </button>
                </div>
              </div>
            ))}

            {!foodsLoading && foods.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No foods loaded. Search or refresh after adding foods in Library.
              </div>
            )}
          </div>
        </div>
      )}

      {status && <div className="mt-3 text-xs text-muted-foreground">{status}</div>}
    </div>
  );
}
