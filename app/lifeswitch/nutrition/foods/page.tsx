"use client";

import * as React from "react";

type UsdaHit = {
  fdc_id: number;
  description: string | null;
  brand_owner: string | null;
  brand_name: string | null;
  gtin_upc: string | null;
  data_type: string | null;
  published_date: string | null;
  score: number | null;
};

type MyFood = {
  my_food_id: string;
  owner_user_id: string;

  display_name: string;
  brand: string | null;
  variant: string | null;

  source_type: string;
  source: string | null;
  source_id: string | null;
  barcode: string | null;

  basis: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;

  is_verified: boolean;
  is_active: boolean;

  created_at: string;
  updated_at: string;
};

function fmt(n: number | null, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

export default function NutritionFoodsPage() {
  // auth (optional for search; required for "My Foods" + importing)
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

  // USDA search
  const [usdaQ, setUsdaQ] = React.useState("hamburger");
  const [usdaLimit, setUsdaLimit] = React.useState("10");
  const [usdaRows, setUsdaRows] = React.useState<UsdaHit[]>([]);
  const [usdaLoading, setUsdaLoading] = React.useState(false);
  const [usdaErr, setUsdaErr] = React.useState<string | null>(null);

  // import options
  const [variant, setVariant] = React.useState("96/4");

  // My Foods list
  const [myFoods, setMyFoods] = React.useState<MyFood[]>([]);
  const [myFilter, setMyFilter] = React.useState("");
  const [myLoading, setMyLoading] = React.useState(false);
  const [myErr, setMyErr] = React.useState<string | null>(null);

  const searchUsda = React.useCallback(async () => {
    const qq = usdaQ.trim();
    if (!qq) {
      setUsdaErr("enter a search term");
      setUsdaRows([]);
      return;
    }

    setUsdaLoading(true);
    setUsdaErr(null);

    try {
      const limit = Math.max(1, Math.min(50, Number(usdaLimit || "10")));
      const url = `/api/catalog/foods/usda/search?q=${encodeURIComponent(qq)}&limit=${encodeURIComponent(String(limit))}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`usda search HTTP ${r.status}: ${t.slice(0, 200)}`);
      }
      const j = await r.json();
      setUsdaRows(Array.isArray(j) ? (j as UsdaHit[]) : []);
    } catch (e: any) {
      setUsdaErr(String(e?.message || e));
      setUsdaRows([]);
    } finally {
      setUsdaLoading(false);
    }
  }, [usdaQ, usdaLimit]);

  const loadMyFoods = React.useCallback(async () => {
    if (!owner) return;

    setMyLoading(true);
    setMyErr(null);

    try {
      const p = new URLSearchParams({ owner_user_id: owner });
      const q = myFilter.trim();
      if (q) p.set("q", q);

      const r = await fetch(`/api/lifeswitch/nutrition/my_foods?${p.toString()}`, { cache: "no-store" });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`my_foods HTTP ${r.status}: ${t.slice(0, 200)}`);
      }
      const j = await r.json();
      setMyFoods(Array.isArray(j) ? (j as MyFood[]) : []);
    } catch (e: any) {
      setMyErr(String(e?.message || e));
      setMyFoods([]);
    } finally {
      setMyLoading(false);
    }
  }, [owner, myFilter]);

  React.useEffect(() => {
    if (owner) void loadMyFoods();
  }, [owner, loadMyFoods]);

  async function importFromUsda(hit: UsdaHit) {
    setUsdaErr(null);
    if (!owner) {
      setUsdaErr("sign in required to import into My Foods");
      return;
    }
    if (!hit?.fdc_id) {
      setUsdaErr("missing fdc_id");
      return;
    }

    try {
      const p = new URLSearchParams({
        owner_user_id: owner,
        fdc_id: String(hit.fdc_id),
      });
      const v = variant.trim();
      if (v) p.set("variant", v);

      const r = await fetch(`/api/lifeswitch/nutrition/my_foods/create_from_usda?${p.toString()}`, {
        method: "POST",
        cache: "no-store",
      });

      const t = await r.text();
      if (!r.ok) throw new Error(`import HTTP ${r.status}: ${t.slice(0, 200)}`);

      // refresh My Foods list after import
      await loadMyFoods();
    } catch (e: any) {
      setUsdaErr(String(e?.message || e));
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">My Foods</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Use USDA search to find foods, import into your private list, then reuse in meal plans.
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Note: the public catalog is currently tiny, so local search won’t find “hamburger” until we ingest more rows.
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {owner ? <div>signed in</div> : <div>not signed in</div>}
          <div className="mt-1 max-w-[320px] break-words">{owner ? owner : authErr || "—"}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* USDA SEARCH */}
        <section className="rounded-lg border p-3">
          <div className="text-sm font-medium">Search USDA (FoodData Central)</div>

          <div className="mt-2 flex gap-2">
            <input
              className="w-full rounded-md border bg-background px-2 py-2 text-sm"
              value={usdaQ}
              onChange={(e) => setUsdaQ(e.target.value)}
              placeholder="e.g. hamburger, ground beef 96% lean, McDonald's hamburger"
              onKeyDown={(e) => {
                if (e.key === "Enter") void searchUsda();
              }}
            />
            <button className="rounded-md border px-3 py-2 text-sm" onClick={() => void searchUsda()} disabled={usdaLoading}>
              {usdaLoading ? "Searching…" : "Search"}
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              className="rounded-md border bg-background px-2 py-2 text-sm"
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              placeholder='variant (optional) e.g. "96/4", "lean", "brand X"'
            />
            <input
              className="rounded-md border bg-background px-2 py-2 text-sm"
              value={usdaLimit}
              onChange={(e) => setUsdaLimit(e.target.value)}
              placeholder="limit (1-50)"
            />
          </div>

          {usdaErr && <div className="mt-2 text-xs text-red-500">{usdaErr}</div>}

          <div className="mt-3 text-xs text-muted-foreground">
            results: <span className="font-semibold">{usdaRows.length}</span>
          </div>

          <div className="mt-2 space-y-2">
            {usdaRows.map((h) => (
              <div key={String(h.fdc_id)} className="rounded-md border p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{h.description || "(no description)"}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {(h.brand_owner || h.brand_name || "unbranded") + " · " + (h.data_type || "unknown")}{" "}
                      {h.published_date ? " · " + h.published_date : ""} · fdc_id {h.fdc_id}
                    </div>
                    {h.gtin_upc ? <div className="mt-0.5 text-xs text-muted-foreground">upc {h.gtin_upc}</div> : null}
                  </div>

                  <button
                    className="shrink-0 rounded-md border px-3 py-1.5 text-xs"
                    onClick={() => void importFromUsda(h)}
                    disabled={!owner}
                    title={!owner ? "Sign in to import" : "Import into My Foods"}
                  >
                    Import
                  </button>
                </div>
              </div>
            ))}

            {!usdaLoading && usdaRows.length === 0 ? (
              <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                No results yet. Enter a query and click Search.
              </div>
            ) : null}
          </div>
        </section>

        {/* MY FOODS */}
        <section className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">My Foods (private)</div>
            <button className="rounded-md border px-3 py-1.5 text-xs" onClick={() => void loadMyFoods()} disabled={!owner || myLoading}>
              {myLoading ? "Loading…" : "Refresh"}
            </button>
          </div>

          <div className="mt-2 flex gap-2">
            <input
              className="w-full rounded-md border bg-background px-2 py-2 text-sm"
              value={myFilter}
              onChange={(e) => setMyFilter(e.target.value)}
              placeholder='filter (optional): "hamburger", "96/4", "cheddar"'
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadMyFoods();
              }}
            />
            <button className="rounded-md border px-3 py-2 text-sm" onClick={() => void loadMyFoods()} disabled={!owner || myLoading}>
              Filter
            </button>
          </div>

          {!owner ? <div className="mt-2 text-xs text-muted-foreground">Sign in to view/save My Foods.</div> : null}
          {myErr ? <div className="mt-2 text-xs text-red-500">{myErr}</div> : null}

          <div className="mt-3 text-xs text-muted-foreground">
            rows: <span className="font-semibold">{myFoods.length}</span>
          </div>

          <div className="mt-2 space-y-2">
            {myFoods.map((f) => (
              <div key={f.my_food_id} className="rounded-md border p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{f.display_name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {f.brand ? f.brand : "—"}
                      {f.variant ? ` · ${f.variant}` : ""}
                      {f.source ? ` · ${f.source}` : ""}
                      {f.source_id ? `:${f.source_id}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">{f.is_verified ? "verified" : "unverified"}</div>
                </div>

                <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                  <div className="rounded-md bg-muted/30 p-2">
                    <div className="opacity-70">kcal/100g</div>
                    <div className="font-semibold">{fmt(f.kcal, 0)}</div>
                  </div>
                  <div className="rounded-md bg-muted/30 p-2">
                    <div className="opacity-70">protein</div>
                    <div className="font-semibold">{fmt(f.protein_g, 1)}g</div>
                  </div>
                  <div className="rounded-md bg-muted/30 p-2">
                    <div className="opacity-70">carbs</div>
                    <div className="font-semibold">{fmt(f.carbs_g, 1)}g</div>
                  </div>
                  <div className="rounded-md bg-muted/30 p-2">
                    <div className="opacity-70">fat</div>
                    <div className="font-semibold">{fmt(f.fat_g, 1)}g</div>
                  </div>
                </div>
              </div>
            ))}

            {owner && !myLoading && myFoods.length === 0 ? (
              <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                Empty. Import something from USDA on the left.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
