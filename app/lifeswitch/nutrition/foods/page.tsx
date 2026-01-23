"use client";

import * as React from "react";

type WhoAmI =
  | { ok: true; sub: string; email?: string | null }
  | { ok: false; error: string };

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

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetch(url, { cache: "no-store", ...(init || {}) });
  const text = await r.text();
  let j: any = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch {
    // not json
  }
  if (!r.ok) {
    const detail = j?.detail || j?.error || text?.slice(0, 300) || `HTTP ${r.status}`;
    throw new Error(String(detail));
  }
  return j;
}

export default function NutritionFoodsPage() {
  const [owner, setOwner] = React.useState<string | null>(null);
  const [authErr, setAuthErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const j = (await fetchJson("/api/auth/whoami")) as WhoAmI;
        if (!j.ok) {
          setOwner(null);
          setAuthErr(j.error || "not signed in");
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
  const [usdaQ, setUsdaQ] = React.useState("ground beef 96% lean");
  const [usdaLimit, setUsdaLimit] = React.useState("10");
  const [usdaRows, setUsdaRows] = React.useState<UsdaHit[]>([]);
  const [usdaLoading, setUsdaLoading] = React.useState(false);
  const [usdaErr, setUsdaErr] = React.useState<string | null>(null);

  // Import options
  const [variant, setVariant] = React.useState("");
  const [importingFdc, setImportingFdc] = React.useState<number | null>(null);
  const [importMsg, setImportMsg] = React.useState<string | null>(null);

  // My foods list
  const [myQ, setMyQ] = React.useState("");
  const [myFoods, setMyFoods] = React.useState<MyFood[]>([]);
  const [myLoading, setMyLoading] = React.useState(false);
  const [myErr, setMyErr] = React.useState<string | null>(null);

  const searchUsda = React.useCallback(async () => {
    const q = usdaQ.trim();
    if (!q) return;

    setUsdaLoading(true);
    setUsdaErr(null);
    setImportMsg(null);
    try {
      const limit = Math.max(1, Math.min(50, parseInt(usdaLimit || "10", 10) || 10));
      const url = `/api/catalog/foods/usda/search?q=${encodeURIComponent(q)}&limit=${limit}`;
      const j = (await fetchJson(url)) as UsdaHit[];
      setUsdaRows(Array.isArray(j) ? j : []);
    } catch (e: any) {
      setUsdaRows([]);
      setUsdaErr(String(e?.message || e));
    } finally {
      setUsdaLoading(false);
    }
  }, [usdaQ, usdaLimit]);

  const loadMyFoods = React.useCallback(async () => {
    if (!owner) return;

    setMyLoading(true);
    setMyErr(null);
    try {
      const params = new URLSearchParams({ owner_user_id: owner });
      const q = myQ.trim();
      if (q) params.set("q", q);
      const url = `/api/lifeswitch/nutrition/my_foods?${params.toString()}`;
      const j = (await fetchJson(url)) as MyFood[];
      setMyFoods(Array.isArray(j) ? j : []);
    } catch (e: any) {
      setMyFoods([]);
      setMyErr(String(e?.message || e));
    } finally {
      setMyLoading(false);
    }
  }, [owner, myQ]);

  React.useEffect(() => {
    if (owner) loadMyFoods();
  }, [owner, loadMyFoods]);

  async function importFromUsda(fdcId: number) {
    if (!owner) return;

    setImportingFdc(fdcId);
    setImportMsg(null);
    try {
      const params = new URLSearchParams({
        owner_user_id: owner,
        fdc_id: String(fdcId),
      });
      const v = variant.trim();
      if (v) params.set("variant", v);

      const url = `/api/lifeswitch/nutrition/my_foods/create_from_usda?${params.toString()}`;
      const j = await fetchJson(url, { method: "POST" });

      setImportMsg(`Imported fdc_id=${fdcId} → my_food_id=${j?.my_food_id || "?"}`);
      await loadMyFoods();
    } catch (e: any) {
      setImportMsg(`Import failed: ${String(e?.message || e)}`);
    } finally {
      setImportingFdc(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-1 text-lg font-semibold">LifeSwitch · Nutrition · Foods</div>
      <div className="text-sm text-muted-foreground">
        USDA text search → import into your private “My Foods” library (with full macros).
      </div>

      {authErr ? (
        <div className="mt-3 rounded-md border p-3 text-sm">
          <div className="font-medium">Not signed in</div>
          <div className="mt-1 text-muted-foreground">/api/auth/whoami: {authErr}</div>
          <div className="mt-2 text-muted-foreground">
            You can still run USDA search below, but importing + My Foods requires being logged in.
          </div>
        </div>
      ) : null}

      {/* USDA SEARCH */}
      <div className="mt-4 rounded-lg border p-4">
        <div className="text-sm font-medium">USDA search</div>

        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end">
          <div className="flex-1">
            <div className="mb-1 text-xs text-muted-foreground">query</div>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={usdaQ}
              onChange={(e) => setUsdaQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchUsda();
              }}
              placeholder='e.g. "ground beef 96% lean"'
            />
          </div>

          <div className="w-28">
            <div className="mb-1 text-xs text-muted-foreground">limit</div>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={usdaLimit}
              onChange={(e) => setUsdaLimit(e.target.value)}
              placeholder="10"
            />
          </div>

          <button
            className="rounded-md border px-3 py-2 text-sm"
            onClick={searchUsda}
            disabled={usdaLoading}
          >
            {usdaLoading ? "Searching…" : "Search"}
          </button>
        </div>

        <div className="mt-2">
          <div className="mb-1 text-xs text-muted-foreground">variant label (optional)</div>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
            placeholder='e.g. "96/4", "McDonalds", "air-fried"'
          />
        </div>

        {usdaErr ? <div className="mt-2 text-sm text-red-500">{usdaErr}</div> : null}
        {importMsg ? <div className="mt-2 text-sm">{importMsg}</div> : null}

        <div className="mt-3 space-y-2">
          {usdaRows.map((h) => (
            <div key={h.fdc_id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{h.description || "—"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    fdc_id {h.fdc_id}
                    {" · "}
                    {h.data_type || "—"}
                    {" · "}
                    {h.brand_owner || h.brand_name || "—"}
                    {" · "}
                    upc {h.gtin_upc || "—"}
                  </div>
                </div>

                <button
                  className="shrink-0 rounded-md border px-3 py-2 text-sm"
                  onClick={() => importFromUsda(h.fdc_id)}
                  disabled={!owner || importingFdc === h.fdc_id}
                  title={!owner ? "Sign in to import" : "Import into My Foods"}
                >
                  {importingFdc === h.fdc_id ? "Importing…" : "Import"}
                </button>
              </div>
            </div>
          ))}

          {!usdaLoading && usdaRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No results yet. Run a search.</div>
          ) : null}
        </div>
      </div>

      {/* MY FOODS */}
      <div className="mt-4 rounded-lg border p-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-sm font-medium">My Foods</div>
            <div className="text-xs text-muted-foreground">Private foods you’ve imported or created.</div>
          </div>

          <button
            className="rounded-md border px-3 py-2 text-sm"
            onClick={loadMyFoods}
            disabled={!owner || myLoading}
            title={!owner ? "Sign in to load" : "Refresh"}
          >
            {myLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="mt-2 flex items-end gap-2">
          <div className="flex-1">
            <div className="mb-1 text-xs text-muted-foreground">filter</div>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={myQ}
              onChange={(e) => setMyQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadMyFoods();
              }}
              placeholder='e.g. "cheddar", "ground beef", "mcdonalds"'
              disabled={!owner}
            />
          </div>
        </div>

        {myErr ? <div className="mt-2 text-sm text-red-500">{myErr}</div> : null}

        <div className="mt-3 space-y-3">
          {myFoods.map((f) => (
            <div key={f.my_food_id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{f.display_name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {f.brand ? `${f.brand} · ` : ""}
                    {f.variant ? `${f.variant} · ` : ""}
                    {f.source_type}/{f.source_id || "—"}
                  </div>
                </div>

                <div className="shrink-0 text-xs text-muted-foreground">per 100g</div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <div className="rounded-md bg-muted p-2">
                  <div className="text-xs text-muted-foreground">kcal</div>
                  <div className="font-semibold">{fmt(f.kcal, 0)}</div>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <div className="text-xs text-muted-foreground">protein (g)</div>
                  <div className="font-semibold">{fmt(f.protein_g, 1)}</div>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <div className="text-xs text-muted-foreground">carbs (g)</div>
                  <div className="font-semibold">{fmt(f.carbs_g, 1)}</div>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <div className="text-xs text-muted-foreground">fat (g)</div>
                  <div className="font-semibold">{fmt(f.fat_g, 1)}</div>
                </div>
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                my_food_id {f.my_food_id}
              </div>
            </div>
          ))}

          {!myLoading && owner && myFoods.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No foods yet. Import from USDA above.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
