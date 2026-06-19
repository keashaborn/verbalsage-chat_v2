"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";

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

export default function MealsPage() {
  const [owner, setOwner] = React.useState<string | null>(null);
  const [authErr, setAuthErr] = React.useState<string | null>(null);

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

  const loadMeals = React.useCallback(async () => {
    if (!owner) return;
    setErr(null);
    const j = (await fetchJson(`/api/lifeswitch/nutrition/meals?owner_user_id=${encodeURIComponent(owner)}`)) as Meal[];
    setMeals(Array.isArray(j) ? j : []);
    if (!selectedMealId && Array.isArray(j) && j.length) setSelectedMealId(j[0].meal_id);
  }, [owner, selectedMealId]);

  const loadItems = React.useCallback(async (mealId: string) => {
    if (!mealId) return;
    setErr(null);
    const j = (await fetchJson(`/api/lifeswitch/nutrition/meals/${encodeURIComponent(mealId)}/items`)) as MealItem[];
    setItems(Array.isArray(j) ? j : []);
  }, []);

  React.useEffect(() => {
    if (!owner) return;

    void (async () => {
      try {
        const db = await fetchOverridesFromDb(owner);
        setFoodOverrides(db);
      } catch {
        setFoodOverrides({});
      }
    })();

    void loadMeals();
  }, [owner, loadMeals]);

  React.useEffect(() => {
    if (selectedMealId) void loadItems(selectedMealId);
  }, [selectedMealId, loadItems]);

  async function createMeal() {
    if (!owner) return;
    setErr(null);
    try {
      const qs = new URLSearchParams({
        owner_user_id: owner,
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
    if (!owner) return;
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ owner_user_id: owner });
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
    if (!owner || !selectedMealId) return;
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
    if (!owner || !selectedMealId) return;
    setErr(null);
    try {
      setDeletingId(meal_item_id);
      const qs = new URLSearchParams({ owner_user_id: owner });
      await fetchJson(
        `/api/lifeswitch/nutrition/meals/${encodeURIComponent(selectedMealId)}/items/${encodeURIComponent(meal_item_id)}/delete?${qs.toString()}`,
        { method: "POST" }
      );
      await loadItems(selectedMealId);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setDeletingId(null);
    }
  }

  async function deactivateMeal() {
    if (!owner || !selectedMealId) return;

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
    <div className="mx-auto max-w-6xl p-4 overflow-x-hidden">
      <div>
        <div className="text-lg font-semibold">Nutrition · Meals</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Create a meal first, select it, then add foods. Meals are templates; logging happens in Capture.
        </div>
      </div>

      {authErr ? (
        <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          <div className="font-medium">Not signed in</div>
          <div className="mt-1">/api/auth/whoami: {authErr}</div>
        </div>
      ) : null}

      {err ? (
        <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {err}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[300px_1fr] [@media(pointer:coarse)]:grid-cols-1">
        <aside className="rounded-xl border bg-muted/10 p-4">
          <div className="text-sm font-semibold">Create meal</div>
          <div className="mt-2 space-y-2">
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Meal name"
              disabled={!owner}
            />
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={createType}
              onChange={(e) => setCreateType(e.target.value as any)}
              disabled={!owner}
            >
              <option value="breakfast">breakfast</option>
              <option value="lunch">lunch</option>
              <option value="dinner">dinner</option>
              <option value="snack">snack</option>
              <option value="other">other</option>
            </select>
            <button
              className="w-full rounded-md border px-3 py-2 text-sm"
              onClick={() => void createMeal()}
              disabled={!owner || !createName.trim()}
            >
              Save new meal
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Meals</div>
            <button
              className="rounded-md border px-2 py-1 text-xs"
              onClick={() => void loadMeals()}
              disabled={!owner}
            >
              Refresh
            </button>
          </div>

          <div className="mt-3 space-y-4">
            {mealsByType.map(({ mealType, meals: typedMeals }) => (
              <div key={mealType}>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {mealType}
                </div>
                <div className="mt-1 space-y-1">
                  {typedMeals.length === 0 ? (
                    <div className="text-xs text-muted-foreground">None</div>
                  ) : (
                    typedMeals.map((m) => (
                      <button
                        key={m.meal_id}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                          selectedMealId === m.meal_id ? "bg-muted" : ""
                        }`}
                        onClick={() => setSelectedMealId(m.meal_id)}
                        disabled={!owner}
                      >
                        {m.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="grid gap-4">
          <section className="rounded-xl border bg-muted/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Selected meal</div>
                {selectedMeal ? (
                  <div className="mt-1 text-sm">
                    {selectedMeal.meal_type} · {selectedMeal.name}
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-muted-foreground">
                    Select or create a meal to edit it.
                  </div>
                )}
              </div>

              <button
                className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700"
                onClick={() => void deactivateMeal()}
                disabled={!owner || !selectedMealId || deletingMealId === selectedMealId}
                title={!selectedMealId ? "Select a meal first" : "Delete selected meal"}
              >
                {deletingMealId === selectedMealId ? "Deleting…" : "Delete Meal"}
              </button>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] [@media(pointer:coarse)]:grid-cols-1">
        <section className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Meal items</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Foods currently in the selected meal.
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">kcal</div>
                <div className="font-semibold">{fmt(totals.kcal, 0)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">protein</div>
                <div className="font-semibold">{fmt(totals.p, 0)}g</div>
              </div>
              <div>
                <div className="text-muted-foreground">carbs</div>
                <div className="font-semibold">{fmt(totals.c, 0)}g</div>
              </div>
              <div>
                <div className="text-muted-foreground">fat</div>
                <div className="font-semibold">{fmt(totals.f, 0)}g</div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {!selectedMealId ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                Select or create a meal first.
              </div>
            ) : null}

            {selectedMealId && items.length === 0 ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                This meal has no foods yet. Search your foods on the right and add items.
              </div>
            ) : null}

            {items.map((it) => (
              <div key={it.meal_item_id} className="rounded-md border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{it.display_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {it.brand ? it.brand : "—"}
                      {it.variant ? ` · ${it.variant}` : ""}
                      {it.serving_name && it.qty_servings != null
                        ? ` · ${it.qty_servings}× ${it.serving_name} (${fmt(resolvedQtyG(it), 0)}g)`
                        : resolvedQtyG(it) != null
                          ? ` · ${fmt(resolvedQtyG(it), 0)}g`
                          : ""}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      kcal {fmt(scaled(it.kcal, resolvedQtyG(it)), 0)} · P{" "}
                      {fmt(scaled(it.protein_g, resolvedQtyG(it)), 0)} · C{" "}
                      {fmt(scaled(it.carbs_g, resolvedQtyG(it)), 0)} · F{" "}
                      {fmt(scaled(it.fat_g, resolvedQtyG(it)), 0)}
                    </div>
                  </div>

                  <button
                    className="shrink-0 rounded-md border px-3 py-1.5 text-xs"
                    onClick={() => void deleteItem(it.meal_item_id)}
                    disabled={!owner || deletingId === it.meal_item_id}
                    title="Remove from meal"
                  >
                    {deletingId === it.meal_item_id ? "Deleting…" : "Remove"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border p-4">
          <div>
            <div className="text-sm font-semibold">Add foods to selected meal</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Search saved foods, adjust grams, then add them to the selected meal template.
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search My Foods"
              disabled={!owner}
              onKeyDown={(e) => {
                if (e.key === "Enter") void searchMyFoods();
              }}
            />
            <button
              className="rounded-md border px-3 py-2 text-sm"
              onClick={() => void searchMyFoods()}
              disabled={!owner || loading}
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {hits.map((f) => (
              <div key={f.my_food_id} className="rounded-md border p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{f.display_name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {f.brand ? f.brand : "—"}
                    {f.variant ? ` · ${f.variant}` : ""}
                    {f.source_type ? ` · ${f.source_type}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    per 100g: kcal {fmt(f.kcal, 0)} · P {fmt(f.protein_g, 1)} · C{" "}
                    {fmt(f.carbs_g, 1)} · F {fmt(f.fat_g, 1)}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <input
                    className="w-24 rounded-md border bg-background px-3 py-2 text-sm"
                    value={gramsFor(f.my_food_id)}
                    onChange={(e) =>
                      setAddGramsByFoodId((p) => ({ ...p, [f.my_food_id]: e.target.value }))
                    }
                    placeholder="g"
                    disabled={!owner}
                  />
                  <button
                    className="rounded-md border px-3 py-2 text-sm"
                    onClick={() => void addItem(f.my_food_id, gramsFor(f.my_food_id))}
                    disabled={!owner || !selectedMealId || addingId === f.my_food_id}
                    title={!selectedMealId ? "Select a meal first" : "Add to meal"}
                  >
                    {addingId === f.my_food_id ? "Adding…" : "Add"}
                  </button>
                </div>
              </div>
            ))}

            {owner && hits.length === 0 ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                Search your saved foods, then add foods to the selected meal template.
              </div>
            ) : null}
          </div>
        </section>
          </div>
        </div>
      </div>
    </div>
  );
}
