"use client";

import * as React from "react";

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

type FoodHit = {
  food_id: string;
  display_name: string;
  brand: string | null;
  barcode: string | null;
  source: string;
  basis: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  score: number;
  matched_text: string;
  matched_source: string;
};

type MealPlanItem = {
  meal_plan_item_id: string;
  meal_plan_id: string;
  meal_label: string;
  sort_order: number;
  food_id: string;
  qty_g: number | null;
  qty_servings: number | null;
  notes: string | null;

  display_name: string;
  brand: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

function fmt(n: number | null, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

function sum(items: MealPlanItem[], key: "kcal" | "protein_g" | "carbs_g" | "fat_g") {
  // per-100g macros in catalog; scale by qty_g when provided; if qty_g missing, treat as 0.
  let total = 0;
  for (const it of items) {
    const per100 = it[key];
    const g = it.qty_g ?? 0;
    if (per100 == null) continue;
    total += (per100 * g) / 100.0;
  }
  return total;
}

export default function LifeSwitchNutritionPage() {
  const [owner, setOwner] = React.useState<string | null>(null);
  const [authErr, setAuthErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/whoami", { cache: "no-store" });
        const j = await r.json();
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

  const [plans, setPlans] = React.useState<MealPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string>("");
  const [planItems, setPlanItems] = React.useState<MealPlanItem[]>([]);

  const [q, setQ] = React.useState("cheddar cheese");
  const [rows, setRows] = React.useState<FoodHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [createName, setCreateName] = React.useState("Cut v1");
  const [createGoal, setCreateGoal] = React.useState<"cut" | "bulk" | "maintain">("cut");
  const [createKcal, setCreateKcal] = React.useState("2200");
  const [createP, setCreateP] = React.useState("180");
  const [createC, setCreateC] = React.useState("200");
  const [createF, setCreateF] = React.useState("70");
  const [addMealLabel, setAddMealLabel] = React.useState<"breakfast" | "lunch" | "dinner" | "snack" | "other">("breakfast");
  const [addQtyG, setAddQtyG] = React.useState("100");

  const loadPlans = React.useCallback(async () => {
    if (!owner) return;

    const r = await fetch(`/api/lifeswitch/nutrition/meal_plans?owner_user_id=${encodeURIComponent(owner!)}`, { cache: "no-store" });
    const txt = await r.text();
    if (!r.ok) throw new Error(`plans HTTP ${r.status}: ${txt.slice(0, 200)}`);
    const data = JSON.parse(txt) as MealPlan[];
    setPlans(Array.isArray(data) ? data : []);
    if (!selectedPlanId && Array.isArray(data) && data.length) setSelectedPlanId(data[0].meal_plan_id);
  }, [owner, selectedPlanId]);

  const loadItems = React.useCallback(async (meal_plan_id: string) => {
    if (!meal_plan_id) {
      setPlanItems([]);
      return;
    }
    const r = await fetch(`/api/lifeswitch/nutrition/meal_plans/${encodeURIComponent(meal_plan_id)}/items`, { cache: "no-store" });
    const txt = await r.text();
    if (!r.ok) throw new Error(`items HTTP ${r.status}: ${txt.slice(0, 200)}`);
    const data = JSON.parse(txt) as MealPlanItem[];
    setPlanItems(Array.isArray(data) ? data : []);
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        await loadPlans();
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, [loadPlans, owner]);

  React.useEffect(() => {
    (async () => {
      try {
        await loadItems(selectedPlanId);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, [selectedPlanId, loadItems]);

  // debounce search
  React.useEffect(() => {
    const query = q.trim();
    if (!query) {
      setRows([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const url = `/api/catalog/foods/search?q=${encodeURIComponent(query)}&limit=20`;
        const r = await fetch(url, { cache: "no-store" });
        const txt = await r.text();
        if (!r.ok) throw new Error(`food search HTTP ${r.status}: ${txt.slice(0, 200)}`);
        setRows(JSON.parse(txt) as FoodHit[]);
      } catch (e: any) {
        setErr(String(e?.message || e));
        setRows([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function createPlan() {
    setErr(null);
    const qs = new URLSearchParams({
      owner_user_id: owner!,
      name: createName.trim(),
      goal: createGoal,
      target_kcal: createKcal,
      target_protein_g: createP,
      target_carbs_g: createC,
      target_fat_g: createF,
    });
    const r = await fetch(`/api/lifeswitch/nutrition/meal_plans/create?${qs.toString()}`, { method: "POST", cache: "no-store" });
    const txt = await r.text();
    if (!r.ok) throw new Error(`create plan HTTP ${r.status}: ${txt.slice(0, 200)}`);
    const plan = JSON.parse(txt) as MealPlan;
    await loadPlans();
    setSelectedPlanId(plan.meal_plan_id);
  }

  async function addToPlan(food_id: string) {
    if (!selectedPlanId) {
      setErr("Select or create a meal plan first.");
      return;
    }
    const qs = new URLSearchParams({
      food_id,
      meal_label: addMealLabel,
      sort_order: "1",
      qty_g: addQtyG.trim() || "100",
    });
    const r = await fetch(`/api/lifeswitch/nutrition/meal_plans/${encodeURIComponent(selectedPlanId)}/items/add?${qs.toString()}`, {
      method: "POST",
      cache: "no-store",
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(`add item HTTP ${r.status}: ${txt.slice(0, 200)}`);
    await loadItems(selectedPlanId);
  }

  const totals = {
    kcal: sum(planItems, "kcal"),
    p: sum(planItems, "protein_g"),
    c: sum(planItems, "carbs_g"),
    f: sum(planItems, "fat_g"),
  };

  const byMeal: Record<string, MealPlanItem[]> = {};
  for (const it of planItems) {
    byMeal[it.meal_label] = byMeal[it.meal_label] || [];
    byMeal[it.meal_label].push(it);
  }

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">LifeSwitch • Nutrition</h1>
        <div className="mt-1 text-sm opacity-80">
          Approved foods library search + persisted meal plan templates (DB-backed).
        </div>
      </div>

      {authErr && (
        <div className="mb-3 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          Sign in required: {authErr}
        </div>
      )}

      {err && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {err}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border p-3">
          <div className="text-sm font-semibold">Meal plans</div>
          <div className="mt-2 flex gap-2">
            <select
              className="w-full rounded-md border px-2 py-2 text-sm"
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
            >
              <option value="">(select plan)</option>
              {plans.map((p) => (
                <option key={p.meal_plan_id} value={p.meal_plan_id}>
                  {p.name} • {p.goal}
                </option>
              ))}
            </select>
            <button className="rounded-md border px-3 py-2 text-sm" onClick={loadPlans}>
              Refresh
            </button>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
            <div className="rounded-md bg-gray-50 p-2 dark:bg-white/5">
              <div className="text-xs opacity-70">kcal</div>
              <div className="font-semibold">{fmt(totals.kcal, 0)}</div>
            </div>
            <div className="rounded-md bg-gray-50 p-2 dark:bg-white/5">
              <div className="text-xs opacity-70">protein</div>
              <div className="font-semibold">{fmt(totals.p, 0)}g</div>
            </div>
            <div className="rounded-md bg-gray-50 p-2 dark:bg-white/5">
              <div className="text-xs opacity-70">carbs</div>
              <div className="font-semibold">{fmt(totals.c, 0)}g</div>
            </div>
            <div className="rounded-md bg-gray-50 p-2 dark:bg-white/5">
              <div className="text-xs opacity-70">fat</div>
              <div className="font-semibold">{fmt(totals.f, 0)}g</div>
            </div>
          </div>

          <div className="mt-3 text-xs opacity-70">
            Default add behavior is temporary (breakfast, 100g). Next: per-meal editor.
          </div>

          <div className="mt-4 border-t pt-3">
            <div className="text-sm font-semibold">Create / update plan</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input className="rounded-md border px-2 py-2 text-sm" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Name" />
              <select className="rounded-md border px-2 py-2 text-sm" value={createGoal} onChange={(e) => setCreateGoal(e.target.value as any)}>
                <option value="cut">cut</option>
                <option value="maintain">maintain</option>
                <option value="bulk">bulk</option>
              </select>
              <input className="rounded-md border px-2 py-2 text-sm" value={createKcal} onChange={(e) => setCreateKcal(e.target.value)} placeholder="kcal" />
              <input className="rounded-md border px-2 py-2 text-sm" value={createP} onChange={(e) => setCreateP(e.target.value)} placeholder="protein g" />
              <input className="rounded-md border px-2 py-2 text-sm" value={createC} onChange={(e) => setCreateC(e.target.value)} placeholder="carbs g" />
              <input className="rounded-md border px-2 py-2 text-sm" value={createF} onChange={(e) => setCreateF(e.target.value)} placeholder="fat g" />
            </div>
            <button className="mt-2 w-full rounded-md border px-3 py-2 text-sm" onClick={createPlan}>
              Save plan
            </button>
          </div>
        </div>

        <div className="rounded-xl border p-3">
          <div className="text-sm font-semibold">Search approved foods</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm md:col-span-2"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search foods…"
              />

              <div className="flex gap-2">
                <select
                  className="w-full rounded-md border px-2 py-2 text-sm"
                  value={addMealLabel}
                  onChange={(e) => setAddMealLabel(e.target.value as any)}
                  title="Meal"
                >
                  <option value="breakfast">breakfast</option>
                  <option value="lunch">lunch</option>
                  <option value="dinner">dinner</option>
                  <option value="snack">snack</option>
                  <option value="other">other</option>
                </select>

                <input
                  className="w-[110px] rounded-md border px-2 py-2 text-sm text-right"
                  value={addQtyG}
                  onChange={(e) => setAddQtyG(e.target.value)}
                  inputMode="decimal"
                  placeholder="grams"
                  title="Grams"
                />
              </div>
            </div>

            <div className="mt-2 text-xs opacity-70 text-right">
              {loading ? "loading…" : `${rows.length} results`} • add: {addMealLabel}, {addQtyG || "—"}g
            </div>
          </div>

          <div className="mt-3 space-y-2 max-h-[520px] overflow-auto">
            {rows.map((f) => (
              <div key={f.food_id} className="rounded-lg border p-3">
                <div className="font-medium">{f.display_name}</div>
                <div className="text-xs opacity-70">
                  {f.brand ? `Brand: ${f.brand} • ` : ""}
                  {f.barcode ? `UPC: ${f.barcode} • ` : ""}
                  Source: {f.source}
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-sm">
                  <div className="rounded-md bg-gray-50 p-2 dark:bg-white/5">
                    <div className="text-xs opacity-70">kcal</div>
                    <div className="font-semibold">{fmt(f.kcal, 0)}</div>
                  </div>
                  <div className="rounded-md bg-gray-50 p-2 dark:bg-white/5">
                    <div className="text-xs opacity-70">P</div>
                    <div className="font-semibold">{fmt(f.protein_g, 1)}</div>
                  </div>
                  <div className="rounded-md bg-gray-50 p-2 dark:bg-white/5">
                    <div className="text-xs opacity-70">C</div>
                    <div className="font-semibold">{fmt(f.carbs_g, 1)}</div>
                  </div>
                  <div className="rounded-md bg-gray-50 p-2 dark:bg-white/5">
                    <div className="text-xs opacity-70">F</div>
                    <div className="font-semibold">{fmt(f.fat_g, 1)}</div>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => addToPlan(f.food_id)}>
                    Add to plan
                  </button>
                  <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => navigator.clipboard.writeText(f.food_id)}>
                    Copy food_id
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border p-3">
        <div className="text-sm font-semibold">Plan items</div>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {Object.entries(byMeal).map(([label, items]) => (
            <div key={label} className="rounded-lg border p-3">
              <div className="font-semibold">{label}</div>
              <div className="mt-2 space-y-2">
                {items.map((it) => (
                  <div key={it.meal_plan_item_id} className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{it.display_name}</div>
                      <div className="text-xs opacity-70">{it.brand ? it.brand : ""}</div>
                      <div className="text-xs opacity-70">qty_g: {it.qty_g ?? "—"}</div>
                    </div>
                    <div className="text-xs opacity-70 text-right">
                      kcal {fmt((it.kcal ?? 0) * ((it.qty_g ?? 0) / 100.0), 0)}
                      <div>P {fmt((it.protein_g ?? 0) * ((it.qty_g ?? 0) / 100.0), 0)}g</div>
                      <div>C {fmt((it.carbs_g ?? 0) * ((it.qty_g ?? 0) / 100.0), 0)}g</div>
                      <div>F {fmt((it.fat_g ?? 0) * ((it.qty_g ?? 0) / 100.0), 0)}g</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!planItems.length && <div className="text-sm opacity-70">No items yet.</div>}
        </div>
      </div>
    </div>
  );
}
