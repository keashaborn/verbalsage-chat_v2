"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";
import Link from "next/link";

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
  qty_servings: number | null;
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

function sumScaled(items: MealPlanItem[], key: "kcal" | "protein_g" | "carbs_g" | "fat_g") {
  let total = 0;
  let any = false;
  for (const it of items) {
    const v = scaled((it as any)[key], it.qty_g);
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
  const [addQtyG, setAddQtyG] = React.useState("100");
  const [addingId, setAddingId] = React.useState<string | null>(null);

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
      setFoodHits(Array.isArray(j) ? j.filter((x) => x.is_active) : []);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setFoodHits([]);
    } finally {
      setFoodLoading(false);
    }
  }

  async function addToPlan(my_food_id: string) {
    if (!selectedPlanId) return;
    setErr(null);
    try {
      setAddingId(my_food_id);
      const qty = (addQtyG || "").trim() || "100";
      const qs = new URLSearchParams({
        my_food_id,
        meal_label: addMealLabel,
        sort_order: "10",
        qty_g: qty,
      });
      await fetchJson(`/api/lifeswitch/nutrition/meal_plans/${encodeURIComponent(selectedPlanId)}/items/add?${qs.toString()}`, { method: "POST" });
      await loadItems(selectedPlanId);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setAddingId(null);
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
    <div className="mx-auto max-w-5xl p-4">

      <div className="mb-3 flex justify-end">
        <Link href="/lifeswitch/plan#nutrition-targets" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30">
          Back
        </Link>
      </div>
      <div className="text-lg font-semibold">Nutrition · Meal Plans</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Build templates from <span className="font-medium">My Foods</span>. No USDA/catalog search here.
      </div>

      {err ? <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{err}</div> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Left: Plans + totals */}
        <section className="rounded-lg border p-3">
          <div className="text-sm font-medium">Plans</div>

          <div className="mt-2 flex gap-2">
            <select
              className="w-full rounded-md border bg-background px-2 py-2 text-sm"
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
            <button className="rounded-md border px-3 py-2 text-sm" onClick={() => void loadPlans()}>
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
            <div className="text-sm font-medium">Create / update plan</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input className="rounded-md border bg-background px-2 py-2 text-sm" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Name" />
              <select className="rounded-md border bg-background px-2 py-2 text-sm" value={createGoal} onChange={(e) => setCreateGoal(e.target.value as any)}>
                <option value="cut">cut</option>
                <option value="maintain">maintain</option>
                <option value="bulk">bulk</option>
              </select>
              <input className="rounded-md border bg-background px-2 py-2 text-sm" value={createKcal} onChange={(e) => setCreateKcal(e.target.value)} placeholder="kcal" />
              <input className="rounded-md border bg-background px-2 py-2 text-sm" value={createP} onChange={(e) => setCreateP(e.target.value)} placeholder="protein g" />
              <input className="rounded-md border bg-background px-2 py-2 text-sm" value={createC} onChange={(e) => setCreateC(e.target.value)} placeholder="carbs g" />
              <input className="rounded-md border bg-background px-2 py-2 text-sm" value={createF} onChange={(e) => setCreateF(e.target.value)} placeholder="fat g" />
            </div>
            <button className="mt-2 w-full rounded-md border px-3 py-2 text-sm" onClick={() => void createPlan()} disabled={!createName.trim()}>
              Save plan
            </button>
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium">Items</div>
            <div className="mt-2 space-y-2">
              {planItems.map((it) => (
                <div key={it.meal_plan_item_id} className="rounded-md border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{it.display_name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {it.brand ? it.brand : "—"} · {it.meal_label} · qty {it.qty_g ?? "—"}g
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      kcal {fmt(scaled(it.kcal, it.qty_g), 0)} · P {fmt(scaled(it.protein_g, it.qty_g), 0)} · C {fmt(scaled(it.carbs_g, it.qty_g), 0)} · F {fmt(scaled(it.fat_g, it.qty_g), 0)}
                    </div>
                  </div>
                </div>
              ))}
              {!selectedPlanId ? <div className="text-xs text-muted-foreground">Select a plan to view items.</div> : null}
            </div>
          </div>
        </section>

        {/* Right: My Foods picker */}
        <section className="rounded-lg border p-3">
          <div className="text-sm font-medium">Add from My Foods</div>

          <div className="mt-2 flex gap-2">
            <input
              className="w-full rounded-md border bg-background px-2 py-2 text-sm"
              value={foodQ}
              onChange={(e) => setFoodQ(e.target.value)}
              placeholder='search your My Foods (e.g. "salmon", "96/4", "cheddar")'
              onKeyDown={(e) => {
                if (e.key === "Enter") void searchMyFoods();
              }}
            />
            <button className="rounded-md border px-3 py-2 text-sm" onClick={() => void searchMyFoods()} disabled={foodLoading}>
              {foodLoading ? "…" : "Search"}
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <select
              className="rounded-md border bg-background px-2 py-2 text-sm"
              value={addMealLabel}
              onChange={(e) => setAddMealLabel(e.target.value as any)}
            >
              <option value="breakfast">breakfast</option>
              <option value="lunch">lunch</option>
              <option value="dinner">dinner</option>
              <option value="snack">snack</option>
              <option value="other">other</option>
            </select>
            <input
              className="rounded-md border bg-background px-2 py-2 text-sm"
              value={addQtyG}
              onChange={(e) => setAddQtyG(e.target.value)}
              placeholder="qty_g (e.g. 150)"
            />
          </div>

          <div className="mt-3 space-y-2">
            {foodHits.map((f) => (
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
                    onClick={() => void addToPlan(f.my_food_id)}
                    disabled={!selectedPlanId || addingId === f.my_food_id}
                    title={!selectedPlanId ? "Select a plan first" : "Add to plan"}
                  >
                    {addingId === f.my_food_id ? "Adding…" : "Add"}
                  </button>
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
