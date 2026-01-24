"use client";

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
  const r = await fetch(url, { cache: "no-store", ...(init || {}) });
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
  const [qtyG, setQtyG] = React.useState("150");
  const [qtyMode, setQtyMode] = React.useState<"grams" | "serving">("grams");
  const [qtyServings, setQtyServings] = React.useState("1");
  const [addingId, setAddingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

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
    if (owner) void loadMeals();
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

  async function addItem(my_food_id: string) {
    if (!owner || !selectedMealId) return;
    setErr(null);
    try {
      setAddingId(my_food_id);
      const qs = new URLSearchParams({
        my_food_id,
        sort_order: "1",
      });

      if (qtyMode === "grams") {
        const g = Number((qtyG || "").trim());
        if (!Number.isFinite(g) || g <= 0) throw new Error("qty_g must be > 0");
        qs.set("qty_g", String(g));
      } else {
        const n = Number((qtyServings || "").trim());
        if (!Number.isFinite(n) || n <= 0) throw new Error("qty_servings must be > 0");

        const sv = await fetchJson(`/api/lifeswitch/nutrition/my_foods/${encodeURIComponent(my_food_id)}/servings`);
        const arr = Array.isArray(sv) ? sv : [];
        const chosen = arr.find((x: any) => x?.is_default) || arr[0];
        if (!chosen?.my_food_serving_id) throw new Error("No serving preset for this food. Add one on Foods page.");
        qs.set("my_food_serving_id", String(chosen.my_food_serving_id));
        qs.set("qty_servings", String(n));
      }

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
    <div className="mx-auto max-w-5xl p-4">
      <div className="text-lg font-semibold">Nutrition · Meals</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Meal templates. Set your typical grams per food here. Scheduling comes later.
      </div>

      {authErr ? (
        <div className="mt-3 rounded-md border p-3 text-sm">
          <div className="font-medium">Not signed in</div>
          <div className="mt-1 text-muted-foreground">/api/auth/whoami: {authErr}</div>
        </div>
      ) : null}

      {err ? <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{err}</div> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Left: meal selection + items */}
        <section className="rounded-lg border p-3">
          <div className="text-sm font-medium">Meals</div>

          <div className="mt-2 flex gap-2">
            <select
              className="w-full rounded-md border bg-background px-2 py-2 text-sm"
              value={selectedMealId}
              onChange={(e) => setSelectedMealId(e.target.value)}
              disabled={!owner}
            >
              <option value="">(select meal)</option>
              {meals.map((m) => (
                <option key={m.meal_id} value={m.meal_id}>
                  {m.meal_type} · {m.name}
                </option>
              ))}
            </select>
            <button className="rounded-md border px-3 py-2 text-sm" onClick={() => void loadMeals()} disabled={!owner}>
              Refresh
            </button>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
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
            <div className="text-sm font-medium">Create meal</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input className="rounded-md border bg-background px-2 py-2 text-sm" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Meal name" />
              <select className="rounded-md border bg-background px-2 py-2 text-sm" value={createType} onChange={(e) => setCreateType(e.target.value as any)}>
                <option value="breakfast">breakfast</option>
                <option value="lunch">lunch</option>
                <option value="dinner">dinner</option>
                <option value="snack">snack</option>
                <option value="other">other</option>
              </select>
            </div>
            <button className="mt-2 w-full rounded-md border px-3 py-2 text-sm" onClick={() => void createMeal()} disabled={!owner}>
              Save meal
            </button>
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium">Meal items</div>
            <div className="mt-2 space-y-2">
              {items.map((it) => (
                <div key={it.meal_item_id} className="rounded-md border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{it.display_name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {it.brand ? it.brand : "—"}
                        {it.variant ? ` · ${it.variant}` : ""}
                        {it.serving_name && it.qty_servings != null
                          ? ` · ${it.qty_servings}× ${it.serving_name} (${fmt(resolvedQtyG(it), 0)}g)`
                          : (resolvedQtyG(it) != null ? ` · ${fmt(resolvedQtyG(it), 0)}g` : "")}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-start gap-2">
                      <div className="pt-0.5 text-xs text-muted-foreground">
                        kcal {fmt(scaled(it.kcal, resolvedQtyG(it)), 0)} · P {fmt(scaled(it.protein_g, resolvedQtyG(it)), 0)} · C {fmt(scaled(it.carbs_g, resolvedQtyG(it)), 0)} · F {fmt(scaled(it.fat_g, resolvedQtyG(it)), 0)}
                      </div>

                      <button
                        className="rounded-md border px-2 py-1 text-xs"
                        onClick={() => void deleteItem(it.meal_item_id)}
                        disabled={!owner || deletingId === it.meal_item_id}
                        title="Remove from meal"
                      >
                        {deletingId === it.meal_item_id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!selectedMealId ? <div className="text-xs text-muted-foreground">Select a meal to view items.</div> : null}
            </div>
          </div>
        </section>

        {/* Right: My Foods picker */}
        <section className="rounded-lg border p-3">
          <div className="text-sm font-medium">Add foods to meal</div>
          <div className="mt-1 text-xs text-muted-foreground">Search your My Foods and set a typical grams amount.</div>

          <div className="mt-2 flex gap-2">
            <input
              className="w-full rounded-md border bg-background px-2 py-2 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder='search My Foods (e.g. "salmon", "bread", "oats")'
              disabled={!owner}
              onKeyDown={(e) => {
                if (e.key === "Enter") void searchMyFoods();
              }}
            />
            <button className="rounded-md border px-3 py-2 text-sm" onClick={() => void searchMyFoods()} disabled={!owner || loading}>
              {loading ? "…" : "Search"}
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <select
              className="rounded-md border bg-background px-2 py-2 text-sm"
              value={qtyMode}
              onChange={(e) => setQtyMode(e.target.value as any)}
              disabled={!owner}
            >
              <option value="grams">grams</option>
              <option value="serving">servings (default preset)</option>
            </select>

            {qtyMode === "grams" ? (
              <input
                className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                value={qtyG}
                onChange={(e) => setQtyG(e.target.value)}
                placeholder="grams (e.g. 150)"
                disabled={!owner}
              />
            ) : (
              <input
                className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                value={qtyServings}
                onChange={(e) => setQtyServings(e.target.value)}
                placeholder="servings (e.g. 2)"
                disabled={!owner}
              />
            )}
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            {qtyMode === "serving" ? "Uses the default serving preset for that food." : "Adds grams to the meal template."}
          </div>

          <div className="mt-3 space-y-2">
            {hits.map((f) => (
              <div key={f.my_food_id} className="rounded-md border p-2">
                <div className="flex items-start justify-between gap-2">
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

                  <button
                    className="shrink-0 rounded-md border px-3 py-1.5 text-xs"
                    onClick={() => void addItem(f.my_food_id)}
                    disabled={!owner || !selectedMealId || addingId === f.my_food_id}
                    title={!selectedMealId ? "Select a meal first" : "Add to meal"}
                  >
                    {addingId === f.my_food_id ? "Adding…" : "Add"}
                  </button>
                </div>
              </div>
            ))}
            {owner && hits.length === 0 ? (
              <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                Search your My Foods, then click Add to place it in the selected meal.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
