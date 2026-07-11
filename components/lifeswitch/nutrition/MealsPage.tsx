"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

type Meal = {
  meal_id: string;
  owner_user_id: string;
  name: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack" | "other";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type MealItem = {
  meal_item_id: string;
  meal_id: string;
  my_food_id: string;

  // quantity modes:
  // - grams mode: qty_g
  // - servings mode: my_food_serving_id + qty_servings
  qty_g: number | null;
  my_food_serving_id: string | null;
  qty_servings: number | null;

  // server-computed resolved grams (coalesce(qty_g, serving_grams*qty_servings))
  qty_g_resolved: number | null;

  // serving preset info (if servings mode)
  serving_name: string | null;
  serving_grams: number | null;

  sort_order: number;
  notes: string | null;

  display_name: string;
  brand: string | null;
  variant: string | null;

  // per 100g
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
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


type FoodOverride = {
  alias?: string;
  default_grams?: number;
};

type OverrideRow = {
  owner_user_id: string;
  my_food_id: string;
  alias: string | null;
  default_grams: number | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

function fmt(n: number | null, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

function scaled(per100: number | null, qty_g: number | null) {
  if (per100 == null || qty_g == null) return null;
  return (per100 * qty_g) / 100.0;
}

function resolvedQtyG(it: MealItem): number | null {
  return it.qty_g_resolved ?? it.qty_g;
}

async function fetchJson(url: string, init?: RequestInit) {
  const r = await authFetch(url, { cache: "no-store", ...(init || {}) });
  const t = await r.text();
  let j: any = null;
  try {
    j = t ? JSON.parse(t) : null;
  } catch { }
  if (!r.ok) {
    const detail = j?.detail || j?.error || t?.slice(0, 200) || `HTTP ${r.status}`;
    throw new Error(String(detail));
  }
  return j;
}


async function fetchOverridesFromDb(): Promise<Record<string, FoodOverride>> {
  const rows = (await fetchJson("/api/lifeswitch/nutrition/my_food_overrides")) as OverrideRow[];

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


export default function MealsPage() {
  const [meals, setMeals] = React.useState<Meal[]>([]);
  const [selectedMealId, setSelectedMealId] = React.useState<string>("");
  const [items, setItems] = React.useState<MealItem[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  // create meal
  const [createName, setCreateName] = React.useState("Breakfast A");
  const [createType, setCreateType] = React.useState<Meal["meal_type"]>("breakfast");

  // my foods picker
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<MyFood[]>([]);
  const [loading, setLoading] = React.useState(false);

  // add item controls
  // add item controls
  const [addGramsByFoodId, setAddGramsByFoodId] = React.useState<Record<string, string>>({});
  const [foodOverrides, setFoodOverrides] = React.useState<Record<string, FoodOverride>>({});

  function gramsFor(my_food_id: string): string {
    const raw = addGramsByFoodId[my_food_id];

    // Preserve exactly what the user is typing, including temporary blank.
    if (raw !== undefined) return raw;

    const g = foodOverrides[my_food_id]?.default_grams;
    if (g != null && Number.isFinite(Number(g)) && Number(g) > 0) {
      return String(g);
    }

    return "100";
  }
  const [addingId, setAddingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deletingMealId, setDeletingMealId] = React.useState<string | null>(null);
  const [openMealActions, setOpenMealActions] = React.useState(false);
  const [openItemActionsId, setOpenItemActionsId] = React.useState("");

  const loadMeals = React.useCallback(async () => {
    setErr(null);
    const j = (await fetchJson("/api/lifeswitch/nutrition/meals")) as Meal[];
    setMeals(Array.isArray(j) ? j : []);
  }, [selectedMealId]);


  const loadItems = React.useCallback(async (mealId: string) => {
    if (!mealId) return;
    setErr(null);
    const j = (await fetchJson(`/api/lifeswitch/nutrition/meals/${encodeURIComponent(mealId)}/items`)) as MealItem[];
    setItems(Array.isArray(j) ? j : []);
  }, []);

  React.useEffect(() => {
    void (async () => {
      try {
        const db = await fetchOverridesFromDb();
        setFoodOverrides(db);
      } catch {
        setFoodOverrides({});
      }
    })();

    void loadMeals();
  }, [loadMeals]);


  React.useEffect(() => {
    if (selectedMealId) void loadItems(selectedMealId);
  }, [selectedMealId, loadItems]);

  async function createMeal() {
    setErr(null);
    try {
      const qs = new URLSearchParams({
        name: createName.trim(),
        meal_type: createType,
      });
      const j = (await fetchJson(`/api/lifeswitch/nutrition/meals/create?${qs.toString()}`, { method: "POST" })) as Meal;
      await loadMeals();
      setSelectedMealId(j.meal_id);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }


  async function searchMyFoods() {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      const qq = q.trim();
      if (qq) qs.set("q", qq);
      const j = (await fetchJson(`/api/lifeswitch/nutrition/my_foods?${qs.toString()}`)) as MyFood[];
      setHits(Array.isArray(j) ? j.filter((x) => x.is_active) : []);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setHits([]);
    } finally {
      setLoading(false);
    }
  }


  async function addItem(my_food_id: string, gramsStr: string) {
    if (!selectedMealId) return;
    setErr(null);
    try {
      setAddingId(my_food_id);
      const qs = new URLSearchParams({
        my_food_id,
        sort_order: "1",
      });

      const g = Number(String(gramsStr || "").trim());
      if (!Number.isFinite(g) || g <= 0) throw new Error("grams must be > 0");
      qs.set("qty_g", String(g));

      await fetchJson(`/api/lifeswitch/nutrition/meals/${encodeURIComponent(selectedMealId)}/items/add?${qs.toString()}`, { method: "POST" });
      await loadItems(selectedMealId);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setAddingId(null);
    }
  }

  async function deleteItem(meal_item_id: string) {
    if (!selectedMealId) return;

    const item = items.find((it) => it.meal_item_id === meal_item_id);
    const label = item?.display_name || "this item";
    const ok = window.confirm(`Remove "${label}" from this meal?`);
    if (!ok) return;

    setErr(null);
    try {
      setDeletingId(meal_item_id);
      await fetchJson(
        `/api/lifeswitch/nutrition/meals/${encodeURIComponent(selectedMealId)}/items/${encodeURIComponent(meal_item_id)}/delete`,
        { method: "POST" }
      );
      setOpenItemActionsId("");
      await loadItems(selectedMealId);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setDeletingId(null);
    }
  }


  async function deactivateMeal() {
    if (!selectedMealId) return;

    const selected = meals.find((m) => m.meal_id === selectedMealId);
    const label = selected ? `${selected.meal_type} · ${selected.name}` : "this meal";

    if (!window.confirm(`Delete ${label}? This removes the meal from your Library but does not delete logged food entries.`)) {
      return;
    }

    setErr(null);

    try {
      setDeletingMealId(selectedMealId);

      await fetchJson(
        `/api/lifeswitch/nutrition/meals/${encodeURIComponent(selectedMealId)}/deactivate`,
        { method: "POST" }
      );

      setSelectedMealId("");
      setItems([]);
      setOpenMealActions(false);
      await loadMeals();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setDeletingMealId(null);
    }
  }

  const selectedMeal = React.useMemo(() => {
    return meals.find((m) => m.meal_id === selectedMealId) || null;
  }, [meals, selectedMealId]);

  const mealsByType = React.useMemo(() => {
    const order: Meal["meal_type"][] = ["breakfast", "lunch", "dinner", "snack", "other"];
    return order.map((mealType) => ({
      mealType,
      meals: meals.filter((m) => m.meal_type === mealType),
    }));
  }, [meals]);

  const totals = React.useMemo(() => {
    const sum = (k: "kcal" | "protein_g" | "carbs_g" | "fat_g") => {
      let total = 0;
      let any = false;
      for (const it of items) {
        const v = scaled((it as any)[k], resolvedQtyG(it));
        if (v == null) continue;
        total += v;
        any = true;
      }
      return any ? total : null;
    };
    return { kcal: sum("kcal"), p: sum("protein_g"), c: sum("carbs_g"), f: sum("fat_g") };
  }, [items]);

  return (
    <div className="mx-auto max-w-6xl overflow-x-hidden p-4">
      <div>
        <div className="text-lg font-semibold">Nutrition · Meals</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Build reusable meals from foods in your library.
        </div>
      </div>

      {err ? (
        <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
          {err}
        </div>
      ) : null}

      <details className="mt-6 rounded-xl border p-4">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">New meal</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Create a reusable meal template.
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Open</div>
          </div>
        </summary>

        <div className="mt-4 grid gap-3">
          <input
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Meal name"
          />

          <select
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={createType}
            onChange={(e) =>
              setCreateType(e.target.value as Meal["meal_type"])
            }
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
            <option value="other">Other</option>
          </select>

          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
            onClick={() => void createMeal()}
            disabled={!createName.trim()}
          >
            Save new meal
          </button>
        </div>
      </details>

      <section className="mt-6 rounded-xl border p-4">
        <div className="text-sm font-semibold">Meals</div>

        {meals.length ? (
          <div className="mt-4 space-y-5">
            {mealsByType.map(({ mealType, meals: typedMeals }) => {
              if (!typedMeals.length) return null;

              return (
                <section key={mealType}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {mealType}
                  </div>

                  <div className="mt-2 space-y-2">
                    {typedMeals.map((m) => {
                      const active = selectedMealId === m.meal_id;

                      return (
                        <div
                          key={m.meal_id}
                          className={`min-w-0 rounded-xl border ${
                            active
                              ? "border-foreground bg-muted/20 ring-1 ring-foreground/60"
                              : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="w-full px-3 py-3 text-left hover:bg-muted/10"
                            onClick={() => {
                              setOpenMealActions(false);
                              setOpenItemActionsId("");
                              setQ("");
                              setHits([]);

                              if (active) {
                                setSelectedMealId("");
                                setItems([]);
                              } else {
                                setSelectedMealId(m.meal_id);
                              }
                            }}
                          >
                            <div className="text-sm font-semibold text-blue-400">
                              {m.name}
                            </div>
                            <div className="mt-1 text-xs capitalize text-muted-foreground">
                              {m.meal_type}
                            </div>
                          </button>

                          {active && selectedMeal ? (
                            <div className="grid gap-4 border-t p-4">
                              <section className="rounded-xl border p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold">
                                      Selected meal
                                    </div>
                                    <div className="mt-1 text-lg font-medium">
                                      {selectedMeal.name}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      className="rounded-xl border px-3 py-1.5 text-sm hover:bg-muted/30"
                                      onClick={() => {
                                        setSelectedMealId("");
                                        setItems([]);
                                        setQ("");
                                        setHits([]);
                                        setOpenMealActions(false);
                                        setOpenItemActionsId("");
                                      }}
                                    >
                                      Close
                                    </button>

                                    <div className="relative">
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/30"
                                        onClick={() =>
                                          setOpenMealActions((v) => !v)
                                        }
                                        aria-expanded={openMealActions}
                                      >
                                        Actions
                                        {openMealActions ? (
                                          <ChevronUp className="h-3 w-3" />
                                        ) : (
                                          <ChevronDown className="h-3 w-3" />
                                        )}
                                      </button>

                                      {openMealActions ? (
                                        <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-red-500/20 bg-background p-2 shadow-lg">
                                          <div className="text-[11px] font-semibold uppercase tracking-wide text-red-500">
                                            Danger zone
                                          </div>
                                          <button
                                            type="button"
                                            className="mt-2 inline-flex w-full items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                                            onClick={() =>
                                              void deactivateMeal()
                                            }
                                            disabled={
                                              deletingMealId === selectedMealId
                                            }
                                          >
                                            <Trash2 className="h-3 w-3" />
                                            {deletingMealId === selectedMealId
                                              ? "Deleting…"
                                              : "Delete meal"}
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </section>

                              <section className="rounded-xl border p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="text-sm font-semibold">
                                    Meal items
                                  </div>

                                  <div className="grid grid-cols-4 gap-4 text-xs">
                                    <div>
                                      <div className="text-muted-foreground">
                                        kcal
                                      </div>
                                      <div className="font-semibold">
                                        {fmt(totals.kcal, 0)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground">
                                        protein
                                      </div>
                                      <div className="font-semibold">
                                        {fmt(totals.p, 0)}g
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground">
                                        carbs
                                      </div>
                                      <div className="font-semibold">
                                        {fmt(totals.c, 0)}g
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground">
                                        fat
                                      </div>
                                      <div className="font-semibold">
                                        {fmt(totals.f, 0)}g
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {items.length ? (
                                  <div className="mt-4 space-y-2">
                                    {items.map((it) => (
                                      <div
                                        key={it.meal_item_id}
                                        className="rounded-xl border p-3"
                                      >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                          <div className="min-w-0">
                                            <div className="truncate text-sm font-medium">
                                              {it.display_name}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                              {it.brand || "—"}
                                              {it.variant
                                                ? ` · ${it.variant}`
                                                : ""}
                                              {resolvedQtyG(it) != null
                                                ? ` · ${fmt(
                                                    resolvedQtyG(it),
                                                    0
                                                  )}g`
                                                : ""}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                              kcal{" "}
                                              {fmt(
                                                scaled(
                                                  it.kcal,
                                                  resolvedQtyG(it)
                                                ),
                                                0
                                              )}{" "}
                                              · P{" "}
                                              {fmt(
                                                scaled(
                                                  it.protein_g,
                                                  resolvedQtyG(it)
                                                ),
                                                0
                                              )}{" "}
                                              · C{" "}
                                              {fmt(
                                                scaled(
                                                  it.carbs_g,
                                                  resolvedQtyG(it)
                                                ),
                                                0
                                              )}{" "}
                                              · F{" "}
                                              {fmt(
                                                scaled(
                                                  it.fat_g,
                                                  resolvedQtyG(it)
                                                ),
                                                0
                                              )}
                                            </div>
                                          </div>

                                          <div className="grid shrink-0 justify-items-end gap-2">
                                            <button
                                              type="button"
                                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/30"
                                              onClick={() =>
                                                setOpenItemActionsId((prev) =>
                                                  prev === it.meal_item_id
                                                    ? ""
                                                    : it.meal_item_id
                                                )
                                              }
                                            >
                                              Actions
                                              {openItemActionsId ===
                                              it.meal_item_id ? (
                                                <ChevronUp className="h-3 w-3" />
                                              ) : (
                                                <ChevronDown className="h-3 w-3" />
                                              )}
                                            </button>

                                            {openItemActionsId ===
                                            it.meal_item_id ? (
                                              <button
                                                type="button"
                                                className="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                                                onClick={() =>
                                                  void deleteItem(
                                                    it.meal_item_id
                                                  )
                                                }
                                                disabled={
                                                  deletingId ===
                                                  it.meal_item_id
                                                }
                                              >
                                                <Trash2 className="h-3 w-3" />
                                                Remove item
                                              </button>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-4 rounded-xl border p-3 text-sm text-muted-foreground">
                                    This meal has no foods yet. Search below
                                    to add one.
                                  </div>
                                )}
                              </section>

                              <section className="rounded-xl border p-4">
                                <div className="text-sm font-semibold">
                                  Add foods to this meal
                                </div>

                                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                  <input
                                    className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search saved foods"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        void searchMyFoods();
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                                    onClick={() => void searchMyFoods()}
                                    disabled={loading}
                                  >
                                    {loading ? "Searching…" : "Search"}
                                  </button>
                                </div>

                                {hits.length ? (
                                  <div className="mt-4 space-y-2">
                                    {hits.map((f) => (
                                      <div
                                        key={f.my_food_id}
                                        className="rounded-xl border p-3"
                                      >
                                        <div className="truncate text-sm font-medium">
                                          {f.display_name}
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          {f.brand || "—"}
                                          {f.variant
                                            ? ` · ${f.variant}`
                                            : ""}
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          per 100g: kcal {fmt(f.kcal, 0)} · P{" "}
                                          {fmt(f.protein_g, 1)} · C{" "}
                                          {fmt(f.carbs_g, 1)} · F{" "}
                                          {fmt(f.fat_g, 1)}
                                        </div>

                                        <div className="mt-3 flex items-center gap-2">
                                          <input
                                            className="w-24 rounded-md border bg-background px-3 py-2 text-sm"
                                            value={gramsFor(f.my_food_id)}
                                            onChange={(e) =>
                                              setAddGramsByFoodId(
                                                (previous) => ({
                                                  ...previous,
                                                  [f.my_food_id]:
                                                    e.target.value,
                                                })
                                              )
                                            }
                                          />
                                          <button
                                            type="button"
                                            className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                                            onClick={() =>
                                              void addItem(
                                                f.my_food_id,
                                                gramsFor(f.my_food_id)
                                              )
                                            }
                                            disabled={
                                              addingId === f.my_food_id
                                            }
                                          >
                                            {addingId === f.my_food_id
                                              ? "Adding…"
                                              : "Add"}
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-4 rounded-xl border p-3 text-sm text-muted-foreground">
                                    Search your saved foods to add an item.
                                  </div>
                                )}
                              </section>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 text-sm text-muted-foreground">
            No meals yet. Create one above.
          </div>
        )}
      </section>
    </div>
  );
}
