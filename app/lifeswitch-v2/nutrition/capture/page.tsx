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

type MealPattern = {
  pattern_id: string;
  name: string;
  items: {
    id: string;
    label: string;
    my_food_id: string | null;
    default_grams: number;
  }[];
};

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

export default function NutritionCapturePage() {
  const [owner, setOwner] = React.useState<string | null>(null);
  const [authErr, setAuthErr] = React.useState<string | null>(null);

  const [foods, setFoods] = React.useState<MyFood[]>([]);
  const [foodsLoading, setFoodsLoading] = React.useState(false);

  const [q, setQ] = React.useState("");
  const [gramsByFood, setGramsByFood] = React.useState<Record<string, string>>({});

  const [overrides, setOverrides] = React.useState<Record<string, FoodOverride>>({});

  const [day, setDay] = React.useState<string>(todayLocalYYYYMMDD());
  const [status, setStatus] = React.useState<string>("");
  const [flash, setFlash] = React.useState<string>("");

  // ----------------------------
  // PATTERNS (core new model)
  // ----------------------------
  const [patterns] = React.useState<MealPattern[]>([
    {
      pattern_id: "breakfast_v1",
      name: "Breakfast",
      items: [
        { id: "eggs", label: "Eggs", my_food_id: null, default_grams: 50 },
        { id: "beef", label: "Lean Beef", my_food_id: null, default_grams: 150 },
        { id: "bread", label: "Bread", my_food_id: null, default_grams: 40 },
      ],
    },
  ]);

  const [activePatternId, setActivePatternId] = React.useState<string>("");

  const activePattern = React.useMemo(() => {
    return patterns.find(p => p.pattern_id === activePatternId) || null;
  }, [activePatternId, patterns]);

  // ----------------------------
  // AUTH
  // ----------------------------
  React.useEffect(() => {
    (async () => {
      try {
        const r = await authFetch("/api/auth/whoami", { cache: "no-store" });
        const j = await r.json().catch(() => null);

        if (!j?.ok) {
          setOwner(null);
          setAuthErr(j?.error || "not signed in");
          return;
        }

        setOwner(String(j.sub || ""));
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
    try {
      const p = new URLSearchParams({ owner_user_id: owner });
      if (q.trim()) p.set("q", q.trim());

      const r = await authFetch(`/api/lifeswitch/nutrition/my_foods?${p.toString()}`, {
        cache: "no-store",
      });

      const t = await r.text();
      if (!r.ok) throw new Error(t);

      const j = JSON.parse(t);
      const list: MyFood[] = Array.isArray(j) ? j : [];
      const active = list.filter(x => x?.is_active);

      setFoods(active);
    } catch (e: any) {
      setFoods([]);
      setStatus(String(e?.message || e));
    } finally {
      setFoodsLoading(false);
    }
  }

  React.useEffect(() => {
    if (!owner) return;
    void loadFoods();
  }, [owner]);

  // ----------------------------
  // LOG (ATOMIC)
  // ----------------------------
  async function logFood(my_food_id: string, grams: number) {
    if (!owner) return;

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

  // ----------------------------
  // PATTERN EXECUTION
  // ----------------------------
  async function executePattern() {
    if (!activePattern || !foods.length) return;

    try {
      setStatus("logging pattern...");

      for (const item of activePattern.items) {
        const match = foods.find(f =>
          (overrides[f.my_food_id]?.alias || f.display_name)
            .toLowerCase()
            .includes(item.label.toLowerCase())
        );

        if (!match) continue;

        const grams =
          gramsByFood[match.my_food_id]
            ? Number(gramsByFood[match.my_food_id])
            : item.default_grams;

        await logFood(match.my_food_id, grams);
      }

      setFlash("Pattern logged");
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

      <div className="flex justify-between items-center">
        <div>
          <div className="text-lg font-semibold">Nutrition · Capture</div>
          <div className="text-xs text-muted-foreground">
            Pattern execution + atomic logging
          </div>
        </div>

        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
      </div>

      {authErr && (
        <div className="mt-3 text-sm text-red-500">{authErr}</div>
      )}

      {flash && (
        <div className="mt-3 text-sm text-green-600">{flash}</div>
      )}

      {/* PATTERN BAR */}
      <div className="mt-4 border rounded p-3">
        <div className="text-sm font-semibold">Pattern</div>

        <select
          className="mt-2 border rounded px-2 py-1 text-sm"
          value={activePatternId}
          onChange={(e) => setActivePatternId(e.target.value)}
        >
          <option value="">Select pattern</option>
          {patterns.map(p => (
            <option key={p.pattern_id} value={p.pattern_id}>
              {p.name}
            </option>
          ))}
        </select>

        {activePattern && (
          <button
            className="mt-2 border rounded px-3 py-1 text-sm"
            onClick={() => void executePattern()}
          >
            Execute Pattern
          </button>
        )}
      </div>

      {/* FOODS */}
      <div className="mt-4">
        <input
          className="border rounded px-2 py-1 w-full text-sm"
          placeholder="search foods"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <button
          className="mt-2 border rounded px-3 py-1 text-sm"
          onClick={() => void loadFoods()}
          disabled={foodsLoading}
        >
          Refresh
        </button>

        <div className="mt-3 space-y-2">
          {foods.map(f => (
            <div key={f.my_food_id} className="border rounded p-2 flex justify-between">
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
                    setGramsByFood(p => ({
                      ...p,
                      [f.my_food_id]: e.target.value
                    }))
                  }
                />

                <button
                  className="border rounded px-2 py-1 text-sm"
                  onClick={() =>
                    logFood(
                      f.my_food_id,
                      Number(gramsByFood[f.my_food_id] || 0)
                    )
                  }
                >
                  Log
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {status && (
        <div className="mt-3 text-xs text-muted-foreground">
          {status}
        </div>
      )}
    </div>
  );
}
