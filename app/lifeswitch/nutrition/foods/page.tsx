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

type MyFood = {
  my_food_id: string;
  owner_user_id: string;
  display_name: string;
  brand: string | null;
  variant: string | null;
  source_type: string;
  source_food_id: string | null;
  source: string | null;
  source_id: string | null;
  barcode: string | null;
  basis: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function fmt(n: number | null, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

export default function LifeSwitchMyFoodsPage() {
  // Owner: prefer auth, but allow manual override so you can iterate without fighting cookies.
  const [owner, setOwner] = React.useState<string | null>(null);
  const [ownerOverride, setOwnerOverride] = React.useState<string>("");
  const effectiveOwner = (owner || ownerOverride.trim()) || null;

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

  const [myFoods, setMyFoods] = React.useState<MyFood[]>([]);
  const [myFoodsLoading, setMyFoodsLoading] = React.useState(false);

  const [q, setQ] = React.useState("hamburger");
  const [variant, setVariant] = React.useState("96/4");
  const [hits, setHits] = React.useState<FoodHit[]>([]);
  const [searching, setSearching] = React.useState(false);

  const [err, setErr] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const loadMyFoods = React.useCallback(async () => {
    if (!effectiveOwner) return;
    setMyFoodsLoading(true);
    setErr(null);
    try {
      const r = await fetch(
        `/api/lifeswitch/nutrition/my_foods?owner_user_id=${encodeURIComponent(effectiveOwner)}`,
        { cache: "no-store" },
      );
      const t = await r.text();
      if (!r.ok) {
        setErr(`my_foods HTTP ${r.status}: ${t}`);
        setMyFoods([]);
        return;
      }
      const j = JSON.parse(t);
      setMyFoods(Array.isArray(j) ? (j as MyFood[]) : []);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setMyFoods([]);
    } finally {
      setMyFoodsLoading(false);
    }
  }, [effectiveOwner]);

  React.useEffect(() => {
    loadMyFoods();
  }, [loadMyFoods]);

  async function doSearch() {
    setSearching(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch(
        `/api/catalog/foods/search?q=${encodeURIComponent(q)}&limit=10`,
        { cache: "no-store" },
      );
      const t = await r.text();
      if (!r.ok) {
        setErr(`catalog search HTTP ${r.status}: ${t}`);
        setHits([]);
        return;
      }
      const j = JSON.parse(t);
      setHits(Array.isArray(j) ? (j as FoodHit[]) : []);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  async function addFromCatalog(food_id: string) {
    if (!effectiveOwner) {
      setErr("owner_user_id missing (sign in or paste a UUID)");
      return;
    }
    setErr(null);
    setMsg(null);

    const params = new URLSearchParams({
      owner_user_id: effectiveOwner,
      food_id,
    });
    const v = variant.trim();
    if (v) params.set("variant", v);

    try {
      const r = await fetch(`/api/lifeswitch/nutrition/my_foods/create_from_catalog?${params.toString()}`, {
        method: "POST",
        cache: "no-store",
      });
      const t = await r.text();
      if (!r.ok) {
        setErr(`create_from_catalog HTTP ${r.status}: ${t}`);
        return;
      }
      setMsg("Added to My Foods");
      await loadMyFoods();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div className="space-y-1">
        <div className="text-2xl font-semibold">Nutrition · My Foods</div>
        <div className="text-sm text-muted-foreground">
          Workflow: search approved catalog → copy into private My Foods → later build meals/meal plans from My Foods.
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">owner_user_id (auto from auth if signed in)</div>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={effectiveOwner || ""}
              onChange={(e) => setOwnerOverride(e.target.value)}
              placeholder="paste owner UUID to test without auth"
            />
            <div className="mt-1 text-xs text-muted-foreground">
              auth: {authErr ? `not ready (${authErr})` : "ok"}
            </div>
          </div>

          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Catalog search</div>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. ground beef 96% lean"
              onKeyDown={(e) => {
                if (e.key === "Enter") doSearch();
              }}
            />
          </div>

          <div className="w-full md:w-56">
            <div className="text-xs text-muted-foreground">Variant label</div>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              placeholder='e.g. "96/4"'
            />
          </div>

          <button
            className="rounded-md border border-border px-3 py-2 text-sm"
            onClick={doSearch}
            disabled={searching}
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>

        {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}
        {msg ? <div className="mt-3 text-sm text-green-700">{msg}</div> : null}

        <div className="mt-4 space-y-2">
          <div className="text-sm font-medium">Results</div>
          {hits.length === 0 ? (
            <div className="text-sm text-muted-foreground">No results loaded yet.</div>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {hits.map((h) => (
                <div key={h.food_id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {h.display_name}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        {h.brand ? `· ${h.brand}` : ""}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {h.source} · {h.basis} · kcal {fmt(h.kcal, 0)} · P {fmt(h.protein_g, 1)} · C {fmt(h.carbs_g, 1)} · F {fmt(h.fat_g, 1)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-md border border-border px-3 py-2 text-sm"
                      onClick={() => addFromCatalog(h.food_id)}
                      disabled={!effectiveOwner}
                      title={!effectiveOwner ? "Set owner_user_id first" : "Copy to My Foods"}
                    >
                      Add to My Foods
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">My Foods</div>
          <button className="rounded-md border border-border px-3 py-2 text-sm" onClick={loadMyFoods} disabled={!effectiveOwner || myFoodsLoading}>
            {myFoodsLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="mt-3 text-sm text-muted-foreground">
          {effectiveOwner ? `${myFoods.length} items` : "Set owner_user_id to load"}
        </div>

        {myFoods.length > 0 ? (
          <div className="mt-3 divide-y divide-border rounded-md border border-border">
            {myFoods.map((f) => (
              <div key={f.my_food_id} className="p-3">
                <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {f.display_name}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        {f.brand ? `· ${f.brand}` : ""}
                        {f.variant ? ` · ${f.variant}` : ""}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {f.source_type} · {f.basis} · kcal {fmt(f.kcal, 0)} · P {fmt(f.protein_g, 1)} · C {fmt(f.carbs_g, 1)} · F {fmt(f.fat_g, 1)}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    id {f.my_food_id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
