"use client";

import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import * as React from "react";
import {
  FoodQuantityControl,
  GRAMS_UNIT,
  preferredQuantitySelection,
  preferredServingSeed,
  resolvedQuantityGrams,
  type FoodQuantitySelection,
  type FoodServingOption,
} from "./FoodQuantityControl";

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

  preferred_mode: "grams" | "serving";
  preferred_quantity: number;
  preferred_serving_id: string | null;
  preferred_serving_name: string | null;
  preferred_serving_grams: number | null;

  is_active: boolean;
};

type FoodLogQuantity =
  | { qty_g: number }
  | { my_food_serving_id: string; qty_servings: number };

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


export default function NutritionCapturePage() {

  const [mode, setMode] = React.useState<CaptureMode>("foods");

  const [foods, setFoods] = React.useState<MyFood[]>([]);
  const [foodsLoading, setFoodsLoading] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [foodQuantityByFood, setFoodQuantityByFood] = React.useState<
    Record<string, FoodQuantitySelection>
  >({});
  const [servingsByFood, setServingsByFood] = React.useState<Record<string, FoodServingOption[]>>({});

  const [meals, setMeals] = React.useState<MealCombo[]>([]);
  const [mealsLoading, setMealsLoading] = React.useState(false);
  const [selectedMealId, setSelectedMealId] = React.useState<string>("");
  const [mealItems, setMealItems] = React.useState<MealComboItem[]>([]);
  const [mealItemsLoading, setMealItemsLoading] = React.useState(false);
  const [mealQuantityByItem, setMealQuantityByItem] = React.useState<Record<string, FoodQuantitySelection>>({});
  const [includedMealItemIds, setIncludedMealItemIds] = React.useState<Record<string, boolean>>({});

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

        const selection = mealQuantityByItem[item.meal_item_id];
        const grams = selection
          ? resolvedQuantityGrams(selection, servingsByFood[item.my_food_id] || [])
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
  }, [mealItems, mealQuantityByItem, includedMealItemIds, servingsByFood]);

  // ----------------------------
  // LOAD FOODS
  // ----------------------------
  async function loadServingsForFoodIds(foodIds: string[]) {
    const ids = [...new Set(foodIds.map((value) => String(value || "").trim()).filter(Boolean))];
    const next: Record<string, FoodServingOption[]> = {};

    await Promise.all(
      ids.map(async (id) => {
        try {
          const servings = (await fetchJson(
            `/api/lifeswitch/nutrition/my_foods/${encodeURIComponent(id)}/servings`
          )) as FoodServingOption[];

          next[id] = Array.isArray(servings) ? servings : [];
        } catch {
          // Keep the preferred/current serving seed when an option request fails.
        }
      })
    );

    setServingsByFood((previous) => ({ ...previous, ...next }));
  }

  async function loadFoods() {
    setFoodsLoading(true);
    setStatus("");

    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());

      const url = p.toString() ? `/api/lifeswitch/nutrition/my_foods?${p.toString()}` : "/api/lifeswitch/nutrition/my_foods";
      const list = (await fetchJson(url)) as MyFood[];
      const active = Array.isArray(list) ? list.filter((x) => x?.is_active) : [];

      setFoods(active);
      setFoodQuantityByFood((previous) => {
        const next = { ...previous };
        for (const food of active) {
          if (!next[food.my_food_id]) next[food.my_food_id] = preferredQuantitySelection(food);
        }
        return next;
      });
      setServingsByFood((previous) => {
        const next = { ...previous };
        for (const food of active) {
          if (!next[food.my_food_id]) next[food.my_food_id] = preferredServingSeed(food);
        }
        return next;
      });
      void loadServingsForFoodIds(active.map((food) => food.my_food_id));
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
    setMealsLoading(true);
    setStatus("");

    try {
      const list = (await fetchJson("/api/lifeswitch/nutrition/meals")) as MealCombo[];
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
      setMealQuantityByItem({});
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
      setMealQuantityByItem(Object.fromEntries(sorted.map((item) => [
        item.meal_item_id,
        item.my_food_serving_id && item.qty_servings != null
          ? { quantity: String(Number(item.qty_servings)), unit: item.my_food_serving_id }
          : { quantity: String(Number(item.qty_g || 0)), unit: GRAMS_UNIT },
      ])));
      setServingsByFood((previous) => {
        const next = { ...previous };
        for (const item of sorted) {
          if (
            item.my_food_serving_id &&
            item.serving_name &&
            Number.isFinite(Number(item.serving_grams)) &&
            Number(item.serving_grams) > 0 &&
            !next[item.my_food_id]
          ) {
            next[item.my_food_id] = [{
              my_food_serving_id: item.my_food_serving_id,
              my_food_id: item.my_food_id,
              name: item.serving_name,
              grams: Number(item.serving_grams),
              is_active: true,
            }];
          }
        }
        return next;
      });
      setIncludedMealItemIds(
        Object.fromEntries(sorted.map((item) => [item.meal_item_id, true]))
      );
      void loadServingsForFoodIds(sorted.map((item) => item.my_food_id));
    } catch (e: any) {
      setMealItems([]);
      setMealQuantityByItem({});
      setIncludedMealItemIds({});
      setStatus(String(e?.message || e));
    } finally {
      setMealItemsLoading(false);
    }
  }

  React.useEffect(() => {
    void loadFoods();
    void loadMeals();
  }, []);

  React.useEffect(() => {
    if (!selectedMealId) {
      setMealItems([]);
      setMealQuantityByItem({});
      setIncludedMealItemIds({});
      return;
    }

    void loadMealItems(selectedMealId);
  }, [selectedMealId]);

  // ----------------------------
  // LOG (ATOMIC)
  // ----------------------------
  async function logFood(my_food_id: string, quantity: FoodLogQuantity) {
    const numericQuantity =
      "qty_g" in quantity ? quantity.qty_g : quantity.qty_servings;

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      throw new Error("quantity must be greater than 0");
    }

    const r = await authFetch("/api/lifeswitch/nutrition/log/entry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        day,
        my_food_id,
        ...quantity,
        sort_order: 1,
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      throw new Error(t);
    }
  }

  function logQuantityForSelection(
    selection: FoodQuantitySelection | undefined,
    servings: FoodServingOption[]
  ): FoodLogQuantity {
    const quantity = Number(selection?.quantity);
    if (!selection || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("quantity must be greater than 0");
    }
    if (selection.unit === GRAMS_UNIT) return { qty_g: quantity };
    const serving = servings.find((row) => row.my_food_serving_id === selection.unit);
    if (!serving) throw new Error("select an available serving unit");
    return { my_food_serving_id: serving.my_food_serving_id, qty_servings: quantity };
  }

  async function logSingleFood(food: MyFood) {
    try {
      setStatus("");

      const quantity = logQuantityForSelection(
        foodQuantityByFood[food.my_food_id],
        servingsByFood[food.my_food_id] || []
      );
      await logFood(food.my_food_id, quantity);

      setFlash(`Logged ${food.display_name}`);
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
        setStatus("Choose at least one food to log.");
        return;
      }

      setStatus(`logging ${selectedMeal.name}...`);
      const batchItems = selectedItems.map((item) => ({
        my_food_id: item.my_food_id,
        ...logQuantityForSelection(
          mealQuantityByItem[item.meal_item_id],
          servingsByFood[item.my_food_id] || []
        ),
        sort_order: item.sort_order,
      }));
      const response = await authFetch("/api/lifeswitch/nutrition/log/entries/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ day, items: batchItems }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      setFlash(`Logged ${selectedMeal.name} (${batchItems.length} foods)`);
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
            Log single foods or saved meals for the selected day.
          </div>
        </div>

        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
      </div>


      {flash && <div className="mt-3 text-sm text-green-600">{flash}</div>}

      <div className="mt-4 flex gap-2">
        <button
          className={`rounded border px-3 py-1 text-sm ${mode === "foods" ? "bg-muted" : ""}`}
          onClick={() => setMode("foods")}
        >
          Foods
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
                Select a meal, adjust quantities if needed, then log the selected foods.
              </div>
            </div>

            <button
              className="border rounded px-3 py-1 text-sm"
              onClick={() => void loadMeals()}
              disabled={mealsLoading}
            >
              {mealsLoading ? "Loading…" : "Refresh"}
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
                  className="rounded border border-emerald-500/60 bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  onClick={() => void logMealCombo()}
                  disabled={mealItemsLoading || mealItems.length === 0}
                >
                  Log selected
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {mealItemsLoading && (
                  <div className="text-xs text-muted-foreground">Loading meal foods…</div>
                )}

                {!mealItemsLoading &&
                  mealItems.map((item) => {
                    const servings = servingsByFood[item.my_food_id] || [];
                    const selection = mealQuantityByItem[item.meal_item_id] || (
                      item.my_food_serving_id && item.qty_servings != null
                        ? { quantity: String(Number(item.qty_servings)), unit: item.my_food_serving_id }
                        : { quantity: String(Number(item.qty_g || 0)), unit: GRAMS_UNIT }
                    );
                    const grams = resolvedQuantityGrams(selection, servings);
                    const rowKcal = scaled(item.kcal, grams);
                    const rowProtein = scaled(item.protein_g, grams);

                    const included = includedMealItemIds[item.meal_item_id] !== false;

                    return (
                      <div key={item.meal_item_id} className={`grid gap-3 rounded border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${included ? "" : "opacity-50"}`}>
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

                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                          <FoodQuantityControl
                            label={item.display_name}
                            value={selection}
                            servings={servings}
                            compact
                            disabled={!included}
                            onChange={(next) =>
                              setMealQuantityByItem((previous) => ({
                                ...previous,
                                [item.meal_item_id]: next,
                              }))
                            }
                          />
                          <button
                            className="rounded border border-emerald-500/45 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
                            disabled={!included || grams == null}
                            onClick={() =>
                              void (async () => {
                                try {
                                  await logFood(
                                    item.my_food_id,
                                    logQuantityForSelection(selection, servings)
                                  );
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
                  <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                    This meal has no foods yet. Add foods in{" "}
                    <Link href="/lifeswitch/nutrition/design/meals" className="font-medium underline underline-offset-4">
                      Library / Meals
                    </Link>
                    .
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "foods" && (
        <div className="mt-4">
          <div className="text-sm font-semibold">Foods</div>

          <input
            className="mt-2 border rounded px-2 py-1 w-full text-sm"
            placeholder="Search foods"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <button
            className="mt-2 border rounded px-3 py-1 text-sm"
            onClick={() => void loadFoods()}
            disabled={foodsLoading}
          >
            {foodsLoading ? "Loading…" : "Refresh"}
          </button>

          <div className="mt-3 space-y-2">
            {foods.map((food) => {
              const servings = servingsByFood[food.my_food_id] || [];
              const selection = foodQuantityByFood[food.my_food_id] || preferredQuantitySelection(food);
              const resolvedGrams = resolvedQuantityGrams(selection, servings);
              const displayName = food.display_name;

              return (
                <div
                  key={food.my_food_id}
                  className="flex flex-col gap-3 rounded border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {displayName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Selected · {fmt(resolvedGrams, 1)}g · kcal{" "}
                      {fmt(scaled(food.kcal, resolvedGrams))} · P{" "}
                      {fmt(scaled(food.protein_g, resolvedGrams), 1)}g · C{" "}
                      {fmt(scaled(food.carbs_g, resolvedGrams), 1)}g · F{" "}
                      {fmt(scaled(food.fat_g, resolvedGrams), 1)}g
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <FoodQuantityControl
                      label={displayName}
                      value={selection}
                      servings={servings}
                      compact
                      onChange={(next) =>
                        setFoodQuantityByFood((previous) => ({
                          ...previous,
                          [food.my_food_id]: next,
                        }))
                      }
                    />
                    <button
                      className="rounded border border-emerald-500/45 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
                      disabled={resolvedGrams == null}
                      onClick={() => void logSingleFood(food)}
                    >
                      Log
                    </button>
                  </div>
                </div>
              );
            })}

            {!foodsLoading && foods.length === 0 && (
              <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                No foods loaded. Search again or add foods in{" "}
                <Link href="/lifeswitch/nutrition/design/foods" className="font-medium underline underline-offset-4">
                  Library / Foods
                </Link>
                .
              </div>
            )}
          </div>
        </div>
      )}
      {status && <div className="mt-3 text-xs text-muted-foreground">{status}</div>}
    </div>
  );
}
