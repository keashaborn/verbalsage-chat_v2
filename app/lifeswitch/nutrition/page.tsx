"use client";

import * as React from "react";

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

function fmt(n: number | null, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

export default function LifeSwitchNutritionPage() {
  const [q, setQ] = React.useState("cheddar cheese");
  const [rows, setRows] = React.useState<FoodHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // debounce query
  React.useEffect(() => {
    const query = q.trim();
    if (!query) {
      setRows([]);
      setErr(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const url = `/api/catalog/foods/search?q=${encodeURIComponent(query)}&limit=20`;
        const r = await fetch(url, { cache: "no-store" });
        const txt = await r.text();
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 200)}`);
        const data = JSON.parse(txt) as FoodHit[];
        setRows(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setErr(String(e?.message || e));
        setRows([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">LifeSwitch • Nutrition</h1>
        <div className="mt-2 text-sm opacity-80">
          Approved foods library search (DB-backed). Imports/approval are admin-side.
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search foods…"
        />
        <div className="text-xs opacity-70 min-w-[90px] text-right">
          {loading ? "loading…" : `${rows.length} results`}
        </div>
      </div>

      {err && (
        <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {err}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {rows.map((f) => (
          <div key={f.food_id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{f.display_name}</div>
                <div className="text-xs opacity-70">
                  {f.brand ? `Brand: ${f.brand} • ` : ""}
                  {f.barcode ? `UPC: ${f.barcode} • ` : ""}
                  Source: {f.source} • {f.basis}
                </div>
              </div>
              <div className="text-xs opacity-70 text-right">
                score {fmt(f.score, 2)}
                <div>{f.matched_source}</div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-2 text-sm">
              <div className="rounded-md bg-gray-50 p-2">
                <div className="text-xs opacity-70">kcal</div>
                <div className="font-semibold">{fmt(f.kcal, 0)}</div>
              </div>
              <div className="rounded-md bg-gray-50 p-2">
                <div className="text-xs opacity-70">protein (g)</div>
                <div className="font-semibold">{fmt(f.protein_g, 1)}</div>
              </div>
              <div className="rounded-md bg-gray-50 p-2">
                <div className="text-xs opacity-70">carbs (g)</div>
                <div className="font-semibold">{fmt(f.carbs_g, 1)}</div>
              </div>
              <div className="rounded-md bg-gray-50 p-2">
                <div className="text-xs opacity-70">fat (g)</div>
                <div className="font-semibold">{fmt(f.fat_g, 1)}</div>
              </div>
            </div>

            <div className="mt-2 text-xs opacity-70">
              matched: <span className="font-mono">{f.matched_text}</span>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                className="rounded-md border px-3 py-1.5 text-sm"
                onClick={() => alert(`TODO: add to Meal Plan Draft\nfood_id=${f.food_id}`)}
              >
                Add to plan draft
              </button>
              <button
                className="rounded-md border px-3 py-1.5 text-sm"
                onClick={() => navigator.clipboard.writeText(f.food_id)}
              >
                Copy food_id
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
