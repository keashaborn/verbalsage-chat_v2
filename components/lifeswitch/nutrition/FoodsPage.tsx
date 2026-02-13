"use client";

import * as React from "react";
import { Search as SearchIcon } from "lucide-react";

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

type MyFoodServing = {
  my_food_serving_id: string;
  my_food_id: string;
  name: string;
  grams: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

type FoodOverride = {
  alias?: string;        // display override
  default_grams?: number; // typical grams
};

const LS_OV_KEY = "vs_food_overrides_v1";
const LS_OV_MIGRATED = "vs_food_overrides_v1_migrated_to_db_v1";

function loadLocalOverrides(): Record<string, FoodOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_OV_KEY);
    const j = raw ? JSON.parse(raw) : {};
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

function saveLocalOverrides(next: Record<string, FoodOverride>) {
  try {
    localStorage.setItem(LS_OV_KEY, JSON.stringify(next));
  } catch { }
}

type OverrideRow = {
  owner_user_id: string;
  my_food_id: string;
  alias: string | null;
  default_grams: number | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

async function fetchOverridesFromDb(owner_user_id: string): Promise<Record<string, FoodOverride>> {
  const qs = new URLSearchParams({ owner_user_id });
  const r = await fetch(`/api/lifeswitch/nutrition/my_food_overrides?${qs.toString()}`, { cache: "no-store" });
  const t = await r.text().catch(() => "");
  if (!r.ok) throw new Error(t.slice(0, 200) || `HTTP ${r.status}`);
  const j = t ? JSON.parse(t) : [];
  const rows: OverrideRow[] = Array.isArray(j) ? j : [];

  const out: Record<string, FoodOverride> = {};
  for (const row of rows) {
    const fid = String(row?.my_food_id || "").trim();
    if (!fid) continue;
    out[fid] = {
      alias: row?.alias ? String(row.alias) : undefined,
      default_grams: row?.default_grams != null ? Number(row.default_grams) : undefined,
    };
  }
  return out;
}

async function upsertOverrideToDb(args: {
  owner_user_id: string;
  my_food_id: string;
  alias?: string;
  default_grams?: number;
  sort_order?: number;
}) {
  const qs = new URLSearchParams({
    owner_user_id: args.owner_user_id,
    my_food_id: args.my_food_id,
  });
  if (args.alias && args.alias.trim()) qs.set("alias", args.alias.trim());
  if (args.default_grams != null && Number.isFinite(args.default_grams) && args.default_grams > 0) {
    qs.set("default_grams", String(args.default_grams));
  }
  if (args.sort_order != null && Number.isFinite(args.sort_order)) qs.set("sort_order", String(args.sort_order));

  const r = await fetch(`/api/lifeswitch/nutrition/my_food_overrides/upsert?${qs.toString()}`, {
    method: "POST",
    cache: "no-store",
  });
  const t = await r.text().catch(() => "");
  if (!r.ok) throw new Error(t.slice(0, 200) || `HTTP ${r.status}`);
  return t ? JSON.parse(t) : null;
}

function scaledFromPer100(per100: number | null, grams: number | null): number | null {
  if (per100 == null || grams == null) return null;
  if (!Number.isFinite(per100) || !Number.isFinite(grams)) return null;
  return (per100 * grams) / 100.0;
}

function fmt(n: number | null, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

export default function NutritionFoodsPage() {
  // auth (optional for search; required for "My Foods" + importing)
  const [owner, setOwner] = React.useState<string | null>(null);
  const [authErr, setAuthErr] = React.useState<string | null>(null);

  // USDA search
  const [usdaQ, setUsdaQ] = React.useState("");
  const [usdaRows, setUsdaRows] = React.useState<UsdaHit[]>([]);
  const [usdaLoading, setUsdaLoading] = React.useState(false);
  const [usdaErr, setUsdaErr] = React.useState<string | null>(null);

  // import options
  const [variant, setVariant] = React.useState("");
  const [importingFdc, setImportingFdc] = React.useState<number | null>(null);

  // My Foods list
  const [myFoods, setMyFoods] = React.useState<MyFood[]>([]);
  const [myFilter, setMyFilter] = React.useState("");
  const [myLoading, setMyLoading] = React.useState(false);
  const [myErr, setMyErr] = React.useState<string | null>(null);

  // Serving presets per My Food (e.g. "slice"=24g, "egg"=50g, "tbsp"=14g)
  const [servOpen, setServOpen] = React.useState<Record<string, boolean>>({});
  const [servMap, setServMap] = React.useState<Record<string, MyFoodServing[]>>({});
  const [servLoading, setServLoading] = React.useState<Record<string, boolean>>({});
  const [servCreating, setServCreating] = React.useState<Record<string, boolean>>({});
  const [servErr, setServErr] = React.useState<Record<string, string | null>>({});
  const [servName, setServName] = React.useState<Record<string, string>>({});
  const [servGrams, setServGrams] = React.useState<Record<string, string>>({});
  const [servDefault, setServDefault] = React.useState<Record<string, boolean>>({});
  const [vw, setVw] = React.useState({
    inner: 0,
    vv: 0,
    docClient: 0,
    docScroll: 0,
    bodyClient: 0,
    dpr: 1,
  });
  // Local-only overrides (alias + default grams)
  const [foodOverrides, setFoodOverrides] = React.useState<Record<string, FoodOverride>>({});
  const [editFoodId, setEditFoodId] = React.useState<string | null>(null);
  const [editAlias, setEditAlias] = React.useState<string>("");
  const [editGrams, setEditGrams] = React.useState<string>("");

  React.useEffect(() => {
    // local fallback immediately (fast paint)
    setFoodOverrides(loadLocalOverrides());
  }, []);

  React.useEffect(() => {
    // once signed in, prefer DB overrides + migrate local once
    if (!owner) return;

    (async () => {
      // 1) migrate local -> DB once
      try {
        const migrated = localStorage.getItem(LS_OV_MIGRATED);
        if (!migrated) {
          const local = loadLocalOverrides();
          const keys = Object.keys(local || {});
          if (keys.length) {
            for (const my_food_id of keys) {
              const ov = local[my_food_id] || {};
              await upsertOverrideToDb({
                owner_user_id: owner,
                my_food_id,
                alias: ov.alias,
                default_grams: ov.default_grams,
              });
            }
          }
          localStorage.setItem(LS_OV_MIGRATED, "1");
          // optional: keep local as backup, or remove to avoid confusion
          // localStorage.removeItem(LS_OV_KEY);
        }
      } catch { }

      // 2) load from DB
      try {
        const db = await fetchOverridesFromDb(owner);
        setFoodOverrides(db);
      } catch (e) {
        // keep local fallback if DB fails
        console.warn("override load failed:", e);
      }
    })();
  }, [owner]);

  function closeFoodEditor() {
    setEditFoodId(null);
    setEditAlias("");
    setEditGrams("");
  }

  function openFoodEditor(f: MyFood) {
    const ov = foodOverrides[f.my_food_id] || {};
    setEditFoodId(f.my_food_id);
    setEditAlias(String(ov.alias ?? ""));
    setEditGrams(ov.default_grams != null ? String(ov.default_grams) : "");
  }

  async function saveFoodEditor() {
    if (!editFoodId) return;
    const alias = editAlias.trim();
    const gramsNum = Number(editGrams.trim());

    const next: Record<string, FoodOverride> = { ...(foodOverrides || {}) };
    next[editFoodId] = {
      alias: alias ? alias : undefined,
      default_grams: Number.isFinite(gramsNum) && gramsNum > 0 ? gramsNum : undefined,
    };

    // optimistic UI
    setFoodOverrides(next);

    try {
      if (owner) {
        await upsertOverrideToDb({
          owner_user_id: owner,
          my_food_id: editFoodId,
          alias: alias ? alias : undefined,
          default_grams: Number.isFinite(gramsNum) && gramsNum > 0 ? gramsNum : undefined,
        });
        // refresh from DB for source-of-truth
        const db = await fetchOverridesFromDb(owner);
        setFoodOverrides(db);
      } else {
        saveLocalOverrides(next);
      }
    } catch (e) {
      // fallback: keep local if DB write fails
      saveLocalOverrides(next);
      console.warn("override save failed:", e);
    } finally {
      closeFoodEditor();
    }
  }

  React.useEffect(() => {
    const snap = () => {
      const doc = document.documentElement;
      const body = document.body;
      const vv = (window as any).visualViewport;
      setVw({
        inner: Math.round(window.innerWidth || 0),
        vv: Math.round(vv?.width || 0),
        docClient: Math.round(doc?.clientWidth || 0),
        docScroll: Math.round(doc?.scrollWidth || 0),
        bodyClient: Math.round(body?.clientWidth || 0),
        dpr: Number(window.devicePixelRatio || 1),
      });
    };
    snap();
    window.addEventListener("resize", snap);
    (window as any).visualViewport?.addEventListener("resize", snap);
    return () => {
      window.removeEventListener("resize", snap);
      (window as any).visualViewport?.removeEventListener("resize", snap);
    };
  }, []);
  async function loadServings(my_food_id: string) {
    setServErr((p) => ({ ...p, [my_food_id]: null }));
    setServLoading((p) => ({ ...p, [my_food_id]: true }));
    try {
      const r = await fetch(`/api/lifeswitch/nutrition/my_foods/${encodeURIComponent(my_food_id)}/servings`, { cache: "no-store" });
      const t = await r.text();
      let j: any = null;
      try { j = t ? JSON.parse(t) : null; } catch { }
      if (!r.ok) throw new Error(j?.detail || j?.error || t?.slice(0, 200) || `HTTP ${r.status}`);
      setServMap((p) => ({ ...p, [my_food_id]: Array.isArray(j) ? j : [] }));
    } catch (e: any) {
      setServMap((p) => ({ ...p, [my_food_id]: [] }));
      setServErr((p) => ({ ...p, [my_food_id]: String(e?.message || e) }));
    } finally {
      setServLoading((p) => ({ ...p, [my_food_id]: false }));
    }
  }

  async function toggleServings(my_food_id: string) {
    const next = !(servOpen[my_food_id] ?? false);
    setServOpen((p) => ({ ...p, [my_food_id]: next }));
    if (next && servMap[my_food_id] == null) {
      await loadServings(my_food_id);
    }
  }

  async function createServing(my_food_id: string) {
    const name = (servName[my_food_id] ?? "").trim();
    const grams = Number((servGrams[my_food_id] ?? "").trim());
    const isDefault = !!(servDefault[my_food_id] ?? false);

    if (!name) throw new Error("serving name required");
    if (!Number.isFinite(grams) || grams <= 0) throw new Error("grams must be > 0");

    setServErr((p) => ({ ...p, [my_food_id]: null }));
    setServCreating((p) => ({ ...p, [my_food_id]: true }));
    try {
      const qs = new URLSearchParams({
        name,
        grams: String(grams),
        is_default: isDefault ? "1" : "0",
      });

      const r = await fetch(
        `/api/lifeswitch/nutrition/my_foods/${encodeURIComponent(my_food_id)}/servings/create?${qs.toString()}`,
        { method: "POST", cache: "no-store" }
      );
      const t = await r.text();
      let j: any = null;
      try { j = t ? JSON.parse(t) : null; } catch { }
      if (!r.ok) throw new Error(j?.detail || j?.error || t?.slice(0, 200) || `HTTP ${r.status}`);

      // refresh list + keep panel open
      setServOpen((p) => ({ ...p, [my_food_id]: true }));
      await loadServings(my_food_id);

      // keep name but reset default checkbox
      setServDefault((p) => ({ ...p, [my_food_id]: false }));
    } catch (e: any) {
      setServErr((p) => ({ ...p, [my_food_id]: String(e?.message || e) }));
    } finally {
      setServCreating((p) => ({ ...p, [my_food_id]: false }));
    }
  }

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
      const limit = 10; // fixed default
      const url = `/api/catalog/foods/usda/search?q=${encodeURIComponent(qq)}&limit=${limit}`;
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
  }, [usdaQ]);

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

  const importedUsdaKeys = React.useMemo(() => {
    const set = new Set<string>();
    for (const f of myFoods) {
      if (!f.is_active) continue;
      if (f.source_type !== 'usda') continue;
      const sid = (f.source_id || '').trim();
      if (!sid) continue;
      const v = (f.variant || '').trim();
      set.add(`${sid}::${v}`);
    }
    return set;
  }, [myFoods]);

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
      setImportingFdc(hit.fdc_id);

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

      await loadMyFoods();
    } catch (e: any) {
      setUsdaErr(String(e?.message || e));
    } finally {
      setImportingFdc(null);
    }
  }

  async function deactivateMyFood(my_food_id: string) {
    if (!owner) return;
    try {
      await fetch(`/api/lifeswitch/nutrition/my_foods/${encodeURIComponent(my_food_id)}/deactivate`, {
        method: "POST",
        cache: "no-store",
      });
      await loadMyFoods();
    } catch (e: any) {
      setMyErr(String(e?.message || e));
    }
  }

  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const [[], setDbgOverflow] = React.useState<string[]>([]);

  return (

    <div className="mx-auto max-w-5xl p-4 overflow-x-hidden">

      <div className="flex flex-col gap-3 lg:flex-row [@media(pointer:coarse)]:flex-col lg:items-start lg:justify-between">
        <div className="min-w-0" />
      </div>

      <div className="mt-5 grid gap-6">
        {/* USDA SEARCH */}
        <div>

          {/* Search (Exercises-style) */}
          <div className="mt-0.5 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
            <input
              className="w-full min-w-0 max-w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={usdaQ}
              onChange={(e) => setUsdaQ(e.target.value)}
              placeholder='Search USDA (name or UPC)'
              inputMode="search"
              autoCapitalize="none"
              autoCorrect="off"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void searchUsda();
                }
              }}
            />

            <button
              type="button"
              className="w-full rounded-xl border px-4 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
              onClick={() => void searchUsda()}
              disabled={usdaLoading || !usdaQ.trim()}
            >
              {usdaLoading ? "Searching…" : "Search"}
            </button>
          </div>

          {/* Flat list */}
          {(!usdaLoading && usdaRows.length === 0) ? (
            <div className="mt-3 text-xs text-muted-foreground">
              No results yet. Enter a query and click Search.
            </div>
          ) : null}

          {usdaRows.length ? (
            <div className="mt-3 divide-y divide-muted/20">
              {usdaRows.map((h) => (
                <div
                  key={String(h.fdc_id)}
                  className="py-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between min-w-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium break-words whitespace-normal">{h.description || "(no description)"}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
                      {(h.brand_owner || h.brand_name || "unbranded") + " · " + (h.data_type || "unknown")}{" "}
                      {h.published_date ? " · " + h.published_date : ""} · fdc_id {h.fdc_id}
                    </div>

                    {h.gtin_upc ? (
                      <div className="mt-0.5 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
                        upc {h.gtin_upc}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex justify-end lg:ml-3 lg:shrink-0">
                    <button
                      className="w-full lg:w-auto rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                      onClick={() => void importFromUsda(h)}
                      disabled={
                        !owner ||
                        importingFdc === h.fdc_id ||
                        importedUsdaKeys.has(`${String(h.fdc_id)}::${variant.trim()}`)
                      }
                      title={!owner ? "Sign in to import" : "Import into My Foods"}
                    >
                      {importingFdc === h.fdc_id
                        ? "Importing…"
                        : importedUsdaKeys.has(`${String(h.fdc_id)}::${variant.trim()}`)
                          ? "Imported"
                          : "Import"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* MY FOODS */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Foods</div>
            <button className="rounded-md border px-3 py-1.5 text-xs" onClick={() => void loadMyFoods()} disabled={!owner || myLoading}>
              {myLoading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {!owner ? <div className="mt-2 text-xs text-muted-foreground">Sign in to view/save My Foods.</div> : null}
          {myErr ? <div className="mt-2 text-xs text-red-500">{myErr}</div> : null}

          <div className="mt-3 divide-y divide-muted/20">
            {myFoods.map((f) => {
              const ov = foodOverrides[f.my_food_id] || {};
              const display = (ov.alias && ov.alias.trim()) ? ov.alias.trim() : f.display_name;

              const g = ov.default_grams ?? null;
              const kcal = scaledFromPer100(f.kcal, g);
              const p = scaledFromPer100(f.protein_g, g);
              const c = scaledFromPer100(f.carbs_g, g);
              const fat = scaledFromPer100(f.fat_g, g);

              return (
                <button
                  key={f.my_food_id}
                  type="button"
                  className="w-full py-3 text-left active:bg-muted/20"
                  onClick={() => openFoodEditor(f)}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium break-words whitespace-normal">{display}</div>

                    <div className="mt-0.5 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
                      {(f.brand ? f.brand : "—")}
                      {f.variant ? ` · ${f.variant}` : ""}
                      {f.source ? ` · ${f.source}` : ""}
                      {f.source_id ? `:${f.source_id}` : ""}
                    </div>

                    {g ? (
                      <div className="mt-1 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
                        {g}g · kcal {fmt(kcal, 0)} · P {fmt(p, 1)} · C {fmt(c, 1)} · F {fmt(fat, 1)}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-muted-foreground">
                        kcal/100g {fmt(f.kcal, 0)} · P {fmt(f.protein_g, 1)}g · C {fmt(f.carbs_g, 1)}g · F {fmt(f.fat_g, 1)}g
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Edit modal */}
          {editFoodId ? (() => {
            const f = myFoods.find((x) => x.my_food_id === editFoodId);
            if (!f) return null;

            return (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
                <div className="w-full max-w-lg rounded-2xl border bg-background p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Edit food</div>
                    <button className="rounded-md border px-2 py-1 text-xs hover:bg-muted/30" onClick={closeFoodEditor}>
                      Close
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3">
                    <div className="grid gap-1">
                      <div className="text-xs text-muted-foreground">Alias</div>
                      <input
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        value={editAlias}
                        onChange={(e) => setEditAlias(e.target.value)}
                        placeholder={f.display_name}
                      />
                    </div>

                    <div className="grid gap-1">
                      <div className="text-xs text-muted-foreground">Default grams</div>
                      <input
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        value={editGrams}
                        onChange={(e) => setEditGrams(e.target.value)}
                        placeholder="e.g. 150"
                        inputMode="decimal"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30"
                        onClick={saveFoodEditor}
                      >
                        Save
                      </button>

                      <button
                        className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30"
                        onClick={closeFoodEditor}
                      >
                        Close
                      </button>
                    </div>

                    <details className="mt-2 border-t border-muted/20 pt-3">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        Danger zone
                      </summary>
                      <div className="mt-2">
                        <button
                          className="w-full rounded-xl border border-red-500/40 px-3 py-2 text-sm text-red-600 hover:bg-red-500/10"
                          onClick={() => void deactivateMyFood(f.my_food_id)}
                          title="Remove from My Foods"
                        >
                          Delete food
                        </button>
                      </div>
                    </details>
                    {/* Servings live here */}
                    <div className="mt-2 border-t border-muted/20 pt-3">
                      <div className="text-sm font-semibold">Servings</div>

                      {servErr[f.my_food_id] ? <div className="mt-2 text-xs text-red-500">{servErr[f.my_food_id]}</div> : null}
                      {servLoading[f.my_food_id] ? <div className="mt-2 text-xs text-muted-foreground">Loading…</div> : null}

                      <div className="mt-2 space-y-1">
                        {(servMap[f.my_food_id] || []).map((sv) => (
                          <div key={sv.my_food_serving_id} className="flex items-center justify-between gap-2 text-xs">
                            <div className="min-w-0 truncate">
                              <span className="font-medium">{sv.name}</span>
                              <span className="text-muted-foreground"> · {fmt(sv.grams, 0)}g</span>
                              {sv.is_default ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px]">default</span> : null}
                            </div>
                          </div>
                        ))}
                        {(servMap[f.my_food_id]?.length ?? 0) === 0 && !servLoading[f.my_food_id] ? (
                          <div className="text-xs text-muted-foreground">None yet. Add one below.</div>
                        ) : null}
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2">
                        <input
                          className="min-w-0 rounded-xl border bg-background px-3 py-2 text-xs"
                          value={servName[f.my_food_id] ?? ""}
                          onChange={(e) => setServName((p) => ({ ...p, [f.my_food_id]: e.target.value }))}
                          placeholder="name (e.g. slice)"
                        />
                        <input
                          className="min-w-0 rounded-xl border bg-background px-3 py-2 text-xs"
                          value={servGrams[f.my_food_id] ?? ""}
                          onChange={(e) => setServGrams((p) => ({ ...p, [f.my_food_id]: e.target.value }))}
                          placeholder="grams"
                          inputMode="decimal"
                        />
                        <button
                          className="rounded-xl border px-3 py-2 text-xs hover:bg-muted/30 disabled:opacity-50"
                          onClick={() => void createServing(f.my_food_id)}
                          disabled={!owner || !!servCreating[f.my_food_id]}
                        >
                          {servCreating[f.my_food_id] ? "Saving…" : "Add serving"}
                        </button>
                      </div>

                      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={!!servDefault[f.my_food_id]}
                          onChange={(e) => setServDefault((p) => ({ ...p, [f.my_food_id]: e.target.checked }))}
                        />
                        set as default
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : null}
        </div>
      </div>
    </div>
  );
}
