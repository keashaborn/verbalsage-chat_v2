"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";
import { ChevronDown, ChevronUp, Search as SearchIcon, Trash2 } from "lucide-react";
import { selectNumberInputValue } from "@/components/lifeswitch/selectInputValue";
import { LifeSwitchToolPanel } from "@/components/lifeswitch/LifeSwitchToolPanel";

type UsdaHit = {
  fdc_id: number;
  description: string | null;
  brand_owner: string | null;
  brand_name: string | null;
  gtin_upc: string | null;
  data_type: string | null;
  published_date: string | null;
  score?: number | null;
  search_score?: number | null;
  guide_score?: number | null;
  confidence?: number | null;
  basis?: string | null;
  serving?: {
    serving_size?: number | null;
    serving_size_unit?: string | null;
    household_serving?: string | null;
  } | null;
  nutrients?: {
    kcal?: number | null;
    protein_g?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
    fiber_g?: number | null;
    sugar_g?: number | null;
    sodium_mg?: number | null;
  } | null;
  macro_check?: {
    macro_kcal_estimate?: number | null;
    kcal_difference?: number | null;
    kcal_difference_pct?: number | null;
    status?: string | null;
  } | null;
  reasons?: string[];
  warnings?: string[];
  matched_queries?: string[];
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

async function fetchOverridesFromDb(): Promise<Record<string, FoodOverride>> {
  const r = await authFetch("/api/lifeswitch/nutrition/my_food_overrides", { cache: "no-store" });
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
  my_food_id: string;
  alias?: string;
  default_grams?: number;
  sort_order?: number;
}) {
  const qs = new URLSearchParams({
    my_food_id: args.my_food_id,
  });
  if (args.alias && args.alias.trim()) qs.set("alias", args.alias.trim());
  if (args.default_grams != null && Number.isFinite(args.default_grams) && args.default_grams > 0) {
    qs.set("default_grams", String(args.default_grams));
  }
  if (args.sort_order != null && Number.isFinite(args.sort_order)) qs.set("sort_order", String(args.sort_order));

  const r = await authFetch(`/api/lifeswitch/nutrition/my_food_overrides/upsert?${qs.toString()}`, {
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
  const [openFoodActionsId, setOpenFoodActionsId] = React.useState("");

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
    void (async () => {
      try {
        const migrated = localStorage.getItem(LS_OV_MIGRATED);
        if (!migrated) {
          const local = loadLocalOverrides();
          const keys = Object.keys(local || {});

          if (keys.length) {
            for (const my_food_id of keys) {
              const ov = local[my_food_id] || {};
              await upsertOverrideToDb({
                my_food_id,
                alias: ov.alias,
                default_grams: ov.default_grams,
              });
            }
          }

          localStorage.setItem(LS_OV_MIGRATED, "1");
        }

        const db = await fetchOverridesFromDb();
        setFoodOverrides(db);
      } catch (e) {
        console.warn("override sync failed:", e);
      }
    })();
  }, []);

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
      await upsertOverrideToDb({
        my_food_id: editFoodId,
        alias: alias ? alias : undefined,
        default_grams: Number.isFinite(gramsNum) && gramsNum > 0 ? gramsNum : undefined,
      });

      // refresh from DB for source-of-truth
      const db = await fetchOverridesFromDb();
      setFoodOverrides(db);
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
      const r = await authFetch(`/api/lifeswitch/nutrition/my_foods/${encodeURIComponent(my_food_id)}/servings`, { cache: "no-store" });
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

      const r = await authFetch(
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
      setUsdaErr("describe a food, brand, UPC, package, cooked/raw state, or grams");
      setUsdaRows([]);
      return;
    }

    setUsdaLoading(true);
    setUsdaErr(null);

    try {
      const limit = 6;
      const url = `/api/catalog/foods/usda/guide?q=${encodeURIComponent(qq)}&limit=${limit}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`guided USDA search HTTP ${r.status}: ${t.slice(0, 200)}`);
      }
      const j = await r.json();
      const candidates = Array.isArray(j?.candidates) ? (j.candidates as UsdaHit[]) : [];
      setUsdaRows(candidates);
      if (!candidates.length) {
        setUsdaErr("No guided USDA matches. Try adding brand, cooked/raw state, package size, or UPC.");
      }
    } catch (e: any) {
      setUsdaErr(String(e?.message || e));
      setUsdaRows([]);
    } finally {
      setUsdaLoading(false);
    }
  }, [usdaQ]);

  const loadMyFoods = React.useCallback(async () => {
    setMyLoading(true);
    setMyErr(null);

    try {
      const p = new URLSearchParams();
      const q = myFilter.trim();
      if (q) p.set("q", q);

      const url = p.toString() ? `/api/lifeswitch/nutrition/my_foods?${p.toString()}` : "/api/lifeswitch/nutrition/my_foods";
      const r = await authFetch(url, { cache: "no-store" });
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
  }, [myFilter]);

  React.useEffect(() => {
    void loadMyFoods();
  }, [loadMyFoods]);

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

    if (!hit?.fdc_id) {
      setUsdaErr("missing fdc_id");
      return;
    }

    try {
      setImportingFdc(hit.fdc_id);

      const p = new URLSearchParams({
        fdc_id: String(hit.fdc_id),
      });
      const v = variant.trim();
      if (v) p.set("variant", v);

      const r = await authFetch(`/api/lifeswitch/nutrition/my_foods/create_from_usda?${p.toString()}`, {
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
    const food = myFoods.find((f) => f.my_food_id === my_food_id);
    const name = food?.display_name || "this food";
    const ok = window.confirm(`Delete food "${name}"? This removes it from your food library.`);
    if (!ok) return;

    try {
      await authFetch(`/api/lifeswitch/nutrition/my_foods/${encodeURIComponent(my_food_id)}/deactivate`, {
        method: "POST",
        cache: "no-store",
      });
      setOpenFoodActionsId("");
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
          {/* LIBRARY ACTIONS */}
          <LifeSwitchToolPanel
            title="Library actions"
            subtitle="Describe a food once, then import the best USDA match."
            storageKey="lifeswitch:nutrition:foods-library-actions"
            defaultOpen={myFoods.length === 0}
          >
            {/* Search USDA */}
            <div className="grid gap-2 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
              <input
                className="w-full min-w-0 max-w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={usdaQ}
                onChange={(e) => setUsdaQ(e.target.value)}
                placeholder="Describe food, brand, UPC, package, cooked/raw, or grams"
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
                {usdaLoading ? "Finding matches…" : "Find food"}
              </button>
            </div>

            {(!usdaLoading && usdaRows.length === 0) ? (
              <div className="mt-3 text-xs text-muted-foreground">
                No results yet. Describe a food and click Find food.
              </div>
            ) : null}

            {usdaRows.length ? (
              <div className="mt-3 grid gap-3">
                {usdaRows.map((h, idx) => {
                  const n = h.nutrients || {};
                  const serving = h.serving || {};
                  const servingText = [
                    serving.household_serving || null,
                    serving.serving_size != null
                      ? `${fmt(Number(serving.serving_size), 0)}${serving.serving_size_unit ? ` ${serving.serving_size_unit}` : ""}`
                      : null,
                  ].filter(Boolean).join(" · ");

                  return (
                    <div key={String(h.fdc_id)} className="rounded-xl border p-3 min-w-0">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-xs font-semibold text-blue-400">
                              {idx === 0 ? "Best match" : `Option ${idx + 1}`}
                            </div>
                            {h.confidence != null ? (
                              <div className="text-[11px] text-muted-foreground">
                                confidence {Math.round(Number(h.confidence) * 100)}%
                              </div>
                            ) : null}
                          </div>

                          <div className="mt-1 text-sm font-semibold break-words whitespace-normal">
                            {h.description || "(no description)"}
                          </div>

                          <div className="mt-1 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
                            {(h.brand_owner || h.brand_name || "unbranded") + " · " + (h.data_type || "unknown")}{" "}
                            {h.published_date ? " · " + h.published_date : ""} · fdc_id {h.fdc_id}
                          </div>

                          {h.gtin_upc ? (
                            <div className="mt-1 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
                              upc {h.gtin_upc}
                            </div>
                          ) : null}

                          <div className="mt-2 rounded-lg border bg-muted/10 p-2 text-xs">
                            <div className="font-medium">Per 100g</div>
                            <div className="mt-1 text-muted-foreground">
                              kcal {fmt(n.kcal ?? null, 0)} · P {fmt(n.protein_g ?? null, 1)}g · C {fmt(n.carbs_g ?? null, 1)}g · F {fmt(n.fat_g ?? null, 1)}g
                            </div>
                            {servingText ? (
                              <div className="mt-1 text-muted-foreground">
                                serving hint: {servingText}
                              </div>
                            ) : null}
                            {h.macro_check?.status ? (
                              <div className="mt-1 text-muted-foreground">
                                macro check: {h.macro_check.status}
                                {h.macro_check.macro_kcal_estimate != null
                                  ? ` · macro kcal ≈ ${fmt(Number(h.macro_check.macro_kcal_estimate), 0)}`
                                  : ""}
                              </div>
                            ) : null}
                          </div>

                          {h.reasons?.length ? (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Why: {h.reasons.join("; ")}
                            </div>
                          ) : null}

                          {h.warnings?.length ? (
                            <div className="mt-2 text-xs text-yellow-500">
                              Check: {h.warnings.join("; ")}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex justify-end lg:ml-3 lg:shrink-0">
                          <button
                            className="w-full lg:w-auto rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                            onClick={() => void importFromUsda(h)}
                            disabled={
                              importingFdc === h.fdc_id ||
                              importedUsdaKeys.has(`${String(h.fdc_id)}::${variant.trim()}`)
                            }
                            title="Import into My Foods"
                          >
                            {importingFdc === h.fdc_id
                              ? "Importing…"
                              : importedUsdaKeys.has(`${String(h.fdc_id)}::${variant.trim()}`)
                                ? "Imported"
                                : "Import"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </LifeSwitchToolPanel>

        {/* MY FOODS */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Foods</div>
            <button className="rounded-md border px-3 py-1.5 text-xs" onClick={() => void loadMyFoods()} disabled={myLoading}>
              {myLoading ? "Loading…" : "Refresh"}
            </button>
          </div>

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
                        onFocus={selectNumberInputValue}
                        onClick={selectNumberInputValue}
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

                    <div className="mt-2 border-t border-muted/20 pt-3">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenFoodActionsId((prev) =>
                            prev === f.my_food_id ? "" : f.my_food_id
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30"
                        aria-expanded={openFoodActionsId === f.my_food_id}
                      >
                        Actions
                        {openFoodActionsId === f.my_food_id ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>

                      {openFoodActionsId === f.my_food_id ? (
                        <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-red-500">
                            Danger zone
                          </div>
                          <button
                            type="button"
                            className="mt-2 inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-600 hover:bg-red-500/10"
                            onClick={() => void deactivateMyFood(f.my_food_id)}
                            title="Remove from My Foods"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete food
                          </button>
                        </div>
                      ) : null}
                    </div>
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
                          onFocus={selectNumberInputValue}
                          onClick={selectNumberInputValue}
                          onChange={(e) => setServGrams((p) => ({ ...p, [f.my_food_id]: e.target.value }))}
                          placeholder="grams"
                          inputMode="decimal"
                      />
                        <button
                          className="rounded-xl border px-3 py-2 text-xs hover:bg-muted/30 disabled:opacity-50"
                          onClick={() => void createServing(f.my_food_id)}
                          disabled={!!servCreating[f.my_food_id]}
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
