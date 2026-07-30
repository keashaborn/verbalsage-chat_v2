"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";
import Link from "next/link";
import { NumericInput } from "@/components/lifeswitch/NumericInput";
import { useConfirmAction } from "@/components/lifeswitch/ConfirmActionProvider";
import {
  FoodQuantityControl,
  GRAMS_UNIT,
  preferredQuantitySelection,
  preferredServingSeed,
  servingUnitLabel,
  type FoodQuantitySelection,
  type FoodServingOption,
} from "@/components/lifeswitch/nutrition/FoodQuantityControl";

type MealPlan = {
  meal_plan_id: string;
  owner_user_id: string;
  name: string;
  goal: "cut" | "bulk" | "maintain";
  target_kcal: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type MealPlanItem = {
  meal_plan_item_id: string;
  meal_plan_id: string;
  meal_label: string;
  sort_order: number;
  my_food_id: string | null;
  food_id: string | null; // legacy
  qty_g: number | null;
  my_food_serving_id: string | null;
  qty_servings: number | null;
  qty_g_resolved: number | null;
  serving_name: string | null;
  serving_grams: number | null;
  notes: string | null;

  display_name: string;
  brand: string | null;
  kcal: number | null;        // per 100g
  protein_g: number | null;   // per 100g
  carbs_g: number | null;     // per 100g
  fat_g: number | null;       // per 100g

  created_at: string;
  updated_at: string;
};

type MyFood = {
  my_food_id: string;
  owner_user_id: string;
  display_name: string;
  brand: string | null;
  variant: string | null;
  source_type: string;
  source_id: string | null;
  basis: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  preferred_mode: "grams" | "serving";
  preferred_quantity: number;
  preferred_serving_id: string | null;
  preferred_serving_name: string | null;
  preferred_serving_grams: number | null;
  is_verified: boolean;
  is_active: boolean;
};

function fmt(n: number | null, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

function scaled(per100: number | null, qty_g: number | null) {
  if (per100 == null || qty_g == null) return null;
  return (per100 * qty_g) / 100.0;
}

function resolvedItemGrams(item: MealPlanItem): number | null {
  return item.qty_g_resolved ?? item.qty_g;
}

function itemQuantityLabel(item: MealPlanItem): string {
  const grams = resolvedItemGrams(item);
  if (item.my_food_serving_id && item.qty_servings != null && item.serving_name) {
    return `${Number(item.qty_servings)} × ${servingUnitLabel(item.serving_name)} · ${fmt(grams, 1)}g`;
  }
  return `${fmt(grams, 1)}g`;
}

function planItemQuantitySelection(item: MealPlanItem): FoodQuantitySelection {
  if (item.my_food_serving_id && item.qty_servings != null) {
    return { quantity: String(Number(item.qty_servings)), unit: item.my_food_serving_id };
  }
  return { quantity: String(Number(item.qty_g || 0)), unit: GRAMS_UNIT };
}

function planItemServingSeed(item: MealPlanItem): FoodServingOption[] {
  const grams = Number(item.serving_grams);
  if (!item.my_food_id || !item.my_food_serving_id || !item.serving_name || !Number.isFinite(grams) || grams <= 0) {
    return [];
  }
  return [{
    my_food_serving_id: item.my_food_serving_id,
    my_food_id: item.my_food_id,
    name: item.serving_name,
    grams,
    is_active: true,
  }];
}

function sumScaled(items: MealPlanItem[], key: "kcal" | "protein_g" | "carbs_g" | "fat_g") {
  let total = 0;
  let any = false;
  for (const it of items) {
    const v = scaled((it as any)[key], resolvedItemGrams(it));
    if (v == null) continue;
    total += v;
    any = true;
  }
  return any ? total : null;
}

async function fetchJson(url: string, init?: RequestInit) {
  const r = await authFetch(url, { cache: "no-store", ...(init || {}) });
  const t = await r.text();
  let j: any = null;
  try {
    j = t ? JSON.parse(t) : null;
  } catch {
    // ignore
  }
  if (!r.ok) {
    const detail = j?.detail || j?.error || t?.slice(0, 200) || `HTTP ${r.status}`;
    throw new Error(String(detail));
  }
  return j;
}

export default function MealPlansPage() {
  const confirmAction = useConfirmAction();
  const [plans, setPlans] = React.useState<MealPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string>("");
  const [planItems, setPlanItems] = React.useState<MealPlanItem[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  // Create plan
  const [createName, setCreateName] = React.useState("Cut v1");
  const [createGoal, setCreateGoal] = React.useState<"cut" | "bulk" | "maintain">("cut");
  const [createKcal, setCreateKcal] = React.useState("2200");
  const [createP, setCreateP] = React.useState("180");
  const [createC, setCreateC] = React.useState("200");
  const [createF, setCreateF] = React.useState("70");

  // My Foods picker
  const [foodQ, setFoodQ] = React.useState("");
  const [foodHits, setFoodHits] = React.useState<MyFood[]>([]);
  const [foodLoading, setFoodLoading] = React.useState(false);

  // Add options
  const [addMealLabel, setAddMealLabel] = React.useState<"breakfast" | "lunch" | "dinner" | "snack" | "other">("breakfast");
  const [servingsByFood, setServingsByFood] = React.useState<Record<string, FoodServingOption[]>>({});
  const [quantityByFood, setQuantityByFood] = React.useState<Record<string, FoodQuantitySelection>>({});
  const [addingId, setAddingId] = React.useState<string | null>(null);
  const [editQuantityByItem, setEditQuantityByItem] = React.useState<Record<string, FoodQuantitySelection>>({});
  const [editLabelByItem, setEditLabelByItem] = React.useState<Record<string, string>>({});
  const [savingItemId, setSavingItemId] = React.useState<string>("");

  async function loadServingsForFoodIds(foodIds: string[]) {
    const ids = [...new Set(foodIds.map((value) => String(value || "").trim()).filter(Boolean))];
    const next: Record<string, FoodServingOption[]> = {};

    await Promise.all(ids.map(async (id) => {
      try {
        const rows = (await fetchJson(
          `/api/lifeswitch/nutrition/my_foods/${encodeURIComponent(id)}/servings`
        )) as FoodServingOption[];
        next[id] = Array.isArray(rows) ? rows : [];
      } catch {
        // Keep the preferred-serving seed if the option request fails.
      }
    }));

    setServingsByFood((previous) => {
      const merged = { ...previous };
      for (const [foodId, rows] of Object.entries(next)) {
        const seeds = previous[foodId] || [];
        merged[foodId] = [
          ...seeds,
          ...rows.filter((row) => !seeds.some((seed) => seed.my_food_serving_id === row.my_food_serving_id)),
        ];
      }
      return merged;
    });
  }

  const loadPlans = React.useCallback(async () => {
    setErr(null);
    try {
      const j = (await fetchJson("/api/lifeswitch/nutrition/meal_plans")) as MealPlan[];
      setPlans(Array.isArray(j) ? j : []);
      if (!selectedPlanId && Array.isArray(j) && j.length) setSelectedPlanId(j[0].meal_plan_id);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setPlans([]);
    }
  }, [selectedPlanId]);

  const loadItems = React.useCallback(async (meal_plan_id: string) => {
    if (!meal_plan_id) return;
    setErr(null);
    try {
      const j = (await fetchJson(`/api/lifeswitch/nutrition/meal_plans/${encodeURIComponent(meal_plan_id)}/items`)) as MealPlanItem[];
      setPlanItems(Array.isArray(j) ? j : []);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setPlanItems([]);
    }
  }, []);

  React.useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  React.useEffect(() => {
    if (selectedPlanId) void loadItems(selectedPlanId);
  }, [selectedPlanId, loadItems]);

  async function createPlan() {
    setErr(null);
    try {
      const qs = new URLSearchParams({
        name: createName.trim(),
        goal: createGoal,
        target_kcal: createKcal,
        target_protein_g: createP,
        target_carbs_g: createC,
        target_fat_g: createF,
      });
      const j = (await fetchJson(`/api/lifeswitch/nutrition/meal_plans/create?${qs.toString()}`, { method: "POST" })) as MealPlan;
      await loadPlans();
      setSelectedPlanId(j.meal_plan_id);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  async function searchMyFoods() {
    setFoodLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      const q = foodQ.trim();
      if (q) qs.set("q", q);
      const url = qs.toString() ? `/api/lifeswitch/nutrition/my_foods?${qs.toString()}` : "/api/lifeswitch/nutrition/my_foods";
      const j = (await fetchJson(url)) as MyFood[];
      const active = Array.isArray(j) ? j.filter((x) => x.is_active) : [];
      setFoodHits(active);
      setQuantityByFood((previous) => {
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
      setErr(String(e?.message || e));
      setFoodHits([]);
    } finally {
      setFoodLoading(false);
    }
  }

  async function addToPlan(food: MyFood) {
    if (!selectedPlanId) return;
    setErr(null);
    try {
      setAddingId(food.my_food_id);
      const selection = quantityByFood[food.my_food_id] || preferredQuantitySelection(food);
      const quantity = Number(selection.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("quantity must be greater than 0");

      const qs = new URLSearchParams({
        my_food_id: food.my_food_id,
        meal_label: addMealLabel,
        sort_order: "10",
      });
      if (selection.unit === GRAMS_UNIT) {
        qs.set("qty_g", String(quantity));
      } else {
        const serving = (servingsByFood[food.my_food_id] || [])
          .find((row) => row.my_food_serving_id === selection.unit);
        if (!serving) throw new Error("select an available serving unit");
        qs.set("my_food_serving_id", serving.my_food_serving_id);
        qs.set("qty_servings", String(quantity));
      }
      await fetchJson(`/api/lifeswitch/nutrition/meal_plans/${encodeURIComponent(selectedPlanId)}/items/add?${qs.toString()}`, { method: "POST" });
      await loadItems(selectedPlanId);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setAddingId(null);
    }
  }

  function openPlanItemActions(item: MealPlanItem) {
    const itemId = item.meal_plan_item_id;
    setEditQuantityByItem((previous) => previous[itemId]
      ? previous
      : { ...previous, [itemId]: planItemQuantitySelection(item) });
    setEditLabelByItem((previous) => previous[itemId]
      ? previous
      : { ...previous, [itemId]: item.meal_label });

    if (item.my_food_id) {
      const seed = planItemServingSeed(item);
      if (seed.length) {
        setServingsByFood((previous) => previous[item.my_food_id!]
          ? previous
          : { ...previous, [item.my_food_id!]: seed });
      }
      void loadServingsForFoodIds([item.my_food_id]);
    }
  }

  async function savePlanItem(item: MealPlanItem) {
    if (!selectedPlanId) return;
    const itemId = item.meal_plan_item_id;
    const selection = editQuantityByItem[itemId] || planItemQuantitySelection(item);
    const quantity = Number(selection.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setErr("quantity must be greater than 0");
      return;
    }

    const qs = new URLSearchParams({
      meal_label: editLabelByItem[itemId] || item.meal_label,
    });
    if (selection.unit === GRAMS_UNIT) {
      qs.set("qty_g", String(quantity));
    } else {
      const serving = (servingsByFood[item.my_food_id || ""] || [])
        .find((row) => row.my_food_serving_id === selection.unit);
      if (!serving) {
        setErr("select an available serving unit");
        return;
      }
      qs.set("my_food_serving_id", serving.my_food_serving_id);
      qs.set("qty_servings", String(quantity));
    }

    setSavingItemId(itemId);
    setErr(null);
    try {
      await fetchJson(
        `/api/lifeswitch/nutrition/meal_plans/${encodeURIComponent(selectedPlanId)}/items/${encodeURIComponent(itemId)}?${qs.toString()}`,
        { method: "PATCH" },
      );
      await loadItems(selectedPlanId);
      setEditQuantityByItem((previous) => {
        const next = { ...previous };
        delete next[itemId];
        return next;
      });
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setSavingItemId("");
    }
  }

  async function removePlanItem(item: MealPlanItem) {
    if (!selectedPlanId) return;
    setSavingItemId(item.meal_plan_item_id);
    setErr(null);
    try {
      await fetchJson(
        `/api/lifeswitch/nutrition/meal_plans/${encodeURIComponent(selectedPlanId)}/items/${encodeURIComponent(item.meal_plan_item_id)}`,
        { method: "DELETE" },
      );
      await loadItems(selectedPlanId);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setSavingItemId("");
    }
  }

  const totals = React.useMemo(() => {
    return {
      kcal: sumScaled(planItems, "kcal"),
      p: sumScaled(planItems, "protein_g"),
      c: sumScaled(planItems, "carbs_g"),
      f: sumScaled(planItems, "fat_g"),
    };
  }, [planItems]);

  return (
    <div className="mx-auto min-w-0 max-w-5xl p-4">

      <div className="mb-3 flex justify-end">
        <Link href="/lifeswitch/plan#nutrition-targets" className="inline-flex min-h-11 items-center rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30 sm:min-h-0">
          Back
        </Link>
      </div>
      <h1 className="text-lg font-semibold">Nutrition · Meal Plans</h1>
      <div className="mt-1 text-sm text-muted-foreground">
        Build reusable plans from foods in your library.
      </div>

      {err ? <div role="alert" className="mt-3 border-l-2 border-destructive/60 bg-destructive/5 py-2 pl-3 text-sm text-destructive">{err}</div> : null}

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        {/* Left: Plans + totals */}
        <section className="min-w-0 rounded-lg border p-3">
          <div className="text-sm font-medium">Plans</div>

          <div className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
            <select
              aria-label="Meal plan"
              className="min-h-11 min-w-0 w-full rounded-md border bg-background px-2 py-2 text-sm sm:min-h-0"
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              disabled={foodLoading}
            >
              <option value="">(select plan)</option>
              {plans.map((p) => (
                <option key={p.meal_plan_id} value={p.meal_plan_id}>
                  {p.name} · {p.goal}
                </option>
              ))}
            </select>
            <button className="min-h-11 rounded-md border px-3 py-2 text-sm sm:min-h-0" onClick={() => void loadPlans()}>
              Refresh
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-md bg-muted/30 p-2">
              <div className="opacity-70">kcal</div>
              <div className="font-semibold">{fmt(totals.kcal, 0)}</div>
            </div>
            <div className="rounded-md bg-muted/30 p-2">
              <div className="opacity-70">protein</div>
              <div className="font-semibold">{fmt(totals.p, 0)}g</div>
            </div>
            <div className="rounded-md bg-muted/30 p-2">
              <div className="opacity-70">carbs</div>
              <div className="font-semibold">{fmt(totals.c, 0)}g</div>
            </div>
            <div className="rounded-md bg-muted/30 p-2">
              <div className="opacity-70">fat</div>
              <div className="font-semibold">{fmt(totals.f, 0)}g</div>
            </div>
          </div>

          <div className="mt-4 rounded-md border bg-muted/20 p-3">
            <div className="text-sm font-medium">Create / update plan</div>
            <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                <span>Name</span>
                <input className="min-h-11 min-w-0 w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Example: Cut v1" />
              </label>
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                <span>Goal</span>
                <select className="min-h-11 min-w-0 w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground" value={createGoal} onChange={(e) => setCreateGoal(e.target.value as any)}>
                  <option value="cut">cut</option>
                  <option value="maintain">maintain</option>
                  <option value="bulk">bulk</option>
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                <span>Calories</span>
                <NumericInput className="min-h-11 min-w-0 w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground" value={createKcal} onValueChange={setCreateKcal} mode="decimal" min={0} required />
              </label>
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                <span>Protein (g)</span>
                <NumericInput className="min-h-11 min-w-0 w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground" value={createP} onValueChange={setCreateP} mode="decimal" min={0} required />
              </label>
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                <span>Carbs (g)</span>
                <NumericInput className="min-h-11 min-w-0 w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground" value={createC} onValueChange={setCreateC} mode="decimal" min={0} required />
              </label>
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                <span>Fat (g)</span>
                <NumericInput className="min-h-11 min-w-0 w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground" value={createF} onValueChange={setCreateF} mode="decimal" min={0} required />
              </label>
            </div>
            <button className="mt-2 min-h-11 w-full rounded-md border px-3 py-2 text-sm" onClick={() => void createPlan()} disabled={!createName.trim()}>
              Save plan
            </button>
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium">Items</div>
            <div className="mt-2 space-y-2">
              {planItems.map((it) => (
                <div key={it.meal_plan_item_id} className="min-w-0 rounded-md border p-2">
                  <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{it.display_name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {it.brand ? it.brand : "—"} · {it.meal_label} · {itemQuantityLabel(it)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground sm:shrink-0 sm:text-right">
                      kcal {fmt(scaled(it.kcal, resolvedItemGrams(it)), 0)} · P {fmt(scaled(it.protein_g, resolvedItemGrams(it)), 0)} · C {fmt(scaled(it.carbs_g, resolvedItemGrams(it)), 0)} · F {fmt(scaled(it.fat_g, resolvedItemGrams(it)), 0)}
                    </div>
                  </div>

                  <details
                    className="group mt-2 min-w-0"
                    onToggle={(event) => {
                      if (event.currentTarget.open) openPlanItemActions(it);
                    }}
                  >
                    <summary className="inline-flex min-h-11 list-none cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground sm:min-h-0 [&::-webkit-details-marker]:hidden">
                      Actions
                      <span className="group-open:hidden">▾</span>
                      <span className="hidden group-open:inline">▴</span>
                    </summary>

                    <div className="mt-2 grid min-w-0 gap-2 rounded-md border bg-background/40 p-2">
                      <select
                        className="min-h-11 rounded-md border bg-background px-2 py-2 text-sm sm:min-h-0"
                        value={editLabelByItem[it.meal_plan_item_id] || it.meal_label}
                        onChange={(event) => setEditLabelByItem((previous) => ({
                          ...previous,
                          [it.meal_plan_item_id]: event.target.value,
                        }))}
                        aria-label={`${it.display_name} meal`}
                      >
                        <option value="breakfast">breakfast</option>
                        <option value="lunch">lunch</option>
                        <option value="dinner">dinner</option>
                        <option value="snack">snack</option>
                        <option value="other">other</option>
                      </select>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <FoodQuantityControl
                          label={it.display_name}
                          value={editQuantityByItem[it.meal_plan_item_id] || planItemQuantitySelection(it)}
                          servings={it.my_food_id
                            ? servingsByFood[it.my_food_id] || planItemServingSeed(it)
                            : []}
                          onChange={(selection) => setEditQuantityByItem((previous) => ({
                            ...previous,
                            [it.meal_plan_item_id]: selection,
                          }))}
                          compact
                          disabled={savingItemId === it.meal_plan_item_id}
                        />
                        <button
                          className="min-h-11 rounded-md border px-3 py-2 text-xs disabled:opacity-50"
                          onClick={() => void savePlanItem(it)}
                          disabled={savingItemId === it.meal_plan_item_id}
                        >
                          {savingItemId === it.meal_plan_item_id ? "Saving…" : "Save"}
                        </button>
                      </div>

                      <div className="border-t border-border/50 pt-2">
                        <button
                          className="min-h-11 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50 sm:min-h-0"
                          onClick={() => {
                            void (async () => {
                              const confirmed = await confirmAction({
                                title: `Remove ${it.display_name}?`,
                                description: "This removes the item from this meal plan.",
                                confirmLabel: "Remove item",
                              });
                              if (confirmed) void removePlanItem(it);
                            })();
                          }}
                          disabled={savingItemId === it.meal_plan_item_id}
                        >
                          Remove item
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
              ))}
              {!selectedPlanId ? <div className="text-xs text-muted-foreground">Select a plan to view items.</div> : null}
            </div>
          </div>
        </section>

        {/* Right: My Foods picker */}
        <section className="min-w-0 rounded-lg border p-3">
          <div className="text-sm font-medium">Add from My Foods</div>

          <label htmlFor="meal-plan-food-search" className="mt-2 block text-xs text-muted-foreground">Search My Foods</label>
          <div className="mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              id="meal-plan-food-search"
              className="min-h-11 min-w-0 w-full rounded-md border bg-background px-2 py-2 text-sm"
              value={foodQ}
              onChange={(e) => setFoodQ(e.target.value)}
              placeholder='Example: salmon, 96/4, cheddar'
              onKeyDown={(e) => {
                if (e.key === "Enter") void searchMyFoods();
              }}
            />
            <button className="min-h-11 rounded-md border px-3 py-2 text-sm" onClick={() => void searchMyFoods()} disabled={foodLoading}>
              {foodLoading ? "…" : "Search"}
            </button>
          </div>

          <div className="mt-2">
            <label htmlFor="meal-plan-meal" className="mb-1 block text-xs text-muted-foreground">Meal</label>
            <select
              id="meal-plan-meal"
              className="min-h-11 w-full rounded-md border bg-background px-2 py-2 text-sm"
              value={addMealLabel}
              onChange={(e) => setAddMealLabel(e.target.value as any)}
            >
              <option value="breakfast">breakfast</option>
              <option value="lunch">lunch</option>
              <option value="dinner">dinner</option>
              <option value="snack">snack</option>
              <option value="other">other</option>
            </select>
          </div>

          <div className="mt-3 space-y-2">
            {foodHits.map((f) => (
              <div key={f.my_food_id} className="min-w-0 rounded-md border p-2">
                <div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{f.display_name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {f.brand ? f.brand : "—"}
                      {f.variant ? ` · ${f.variant}` : ""}
                      {f.source_type ? ` · ${f.source_type}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      per 100g: kcal {fmt(f.kcal, 0)} · P {fmt(f.protein_g, 1)} · C {fmt(f.carbs_g, 1)} · F {fmt(f.fat_g, 1)}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <FoodQuantityControl
                      label={f.display_name}
                      value={quantityByFood[f.my_food_id] || preferredQuantitySelection(f)}
                      servings={servingsByFood[f.my_food_id] || preferredServingSeed(f)}
                      onChange={(selection) => setQuantityByFood((previous) => ({
                        ...previous,
                        [f.my_food_id]: selection,
                      }))}
                      compact
                      disabled={addingId === f.my_food_id}
                    />
                    <button
                    className="min-h-11 shrink-0 rounded-md border px-3 py-1.5 text-xs"
                    onClick={() => void addToPlan(f)}
                    disabled={!selectedPlanId || addingId === f.my_food_id}
                    title={!selectedPlanId ? "Select a plan first" : "Add to plan"}
                  >
                    {addingId === f.my_food_id ? "Adding…" : "Add"}
                  </button>
                  </div>
                </div>
              </div>
            ))}
            {foodHits.length == 0 ? (
              <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                Search your My Foods to add items to this plan.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
