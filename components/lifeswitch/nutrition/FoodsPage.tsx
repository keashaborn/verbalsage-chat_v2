"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";
import { Camera, ChevronDown, ChevronUp, Search, Trash2 } from "lucide-react";
import { useConfirmAction } from "@/components/lifeswitch/ConfirmActionProvider";
import { NumericInput } from "@/components/lifeswitch/NumericInput";
import { LifeSwitchToolPanel } from "@/components/lifeswitch/LifeSwitchToolPanel";
import BarcodeScanner from "./BarcodeScanner";

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
  source_display_name: string | null;
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
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;

  nutrient_source: string;
  nutrient_source_detail: string | null;
  nutrient_updated_at: string;

  preferred_mode: "grams" | "serving";
  preferred_quantity: number;
  preferred_serving_id: string | null;
  preferred_serving_name: string | null;
  preferred_serving_grams: number | null;

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
  source_type: string;
  source_label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type NutritionDraft = {
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
};

const emptyNutritionDraft: NutritionDraft = {
  kcal: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  fiber_g: "",
  sugar_g: "",
  sodium_mg: "",
};

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await authFetch(url, { cache: "no-store", ...(init || {}) });
  const t = await r.text();
  let j: any = null;
  try { j = t ? JSON.parse(t) : null; } catch { }
  if (!r.ok) throw new Error(j?.detail || j?.error || t.slice(0, 200) || `HTTP ${r.status}`);
  return j as T;
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

function fmtQty(n: number) {
  return Number(Number(n || 0).toFixed(3)).toString();
}

export default function NutritionFoodsPage() {
  const confirmAction = useConfirmAction();
  // USDA search
  const [usdaQ, setUsdaQ] = React.useState("");
  const [barcodeQ, setBarcodeQ] = React.useState("");
  const [lookupMode, setLookupMode] = React.useState<"description" | "barcode">("description");
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [usdaRows, setUsdaRows] = React.useState<UsdaHit[]>([]);
  const [usdaLoading, setUsdaLoading] = React.useState(false);
  const [usdaErr, setUsdaErr] = React.useState<string | null>(null);

  // import options
  const [variant, setVariant] = React.useState("");
  const [importingFdc, setImportingFdc] = React.useState<number | null>(null);

  const [myFoods, setMyFoods] = React.useState<MyFood[]>([]);
  const [myLoading, setMyLoading] = React.useState(false);
  const [myErr, setMyErr] = React.useState<string | null>(null);
  const [servMap, setServMap] = React.useState<Record<string, MyFoodServing[]>>({});
  const [servLoading, setServLoading] = React.useState<Record<string, boolean>>({});
  const [servCreating, setServCreating] = React.useState<Record<string, boolean>>({});
  const [servErr, setServErr] = React.useState<Record<string, string | null>>({});
  const [servName, setServName] = React.useState<Record<string, string>>({});
  const [servGrams, setServGrams] = React.useState<Record<string, string>>({});
  const [servPreferred, setServPreferred] = React.useState<Record<string, boolean>>({});
  const [editingServingId, setEditingServingId] = React.useState<string | null>(null);
  const [editingServingName, setEditingServingName] = React.useState("");
  const [editingServingGrams, setEditingServingGrams] = React.useState("");
  const [servSavingId, setServSavingId] = React.useState<string | null>(null);

  const [editFoodId, setEditFoodId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editBrand, setEditBrand] = React.useState("");
  const [editPreferredUnit, setEditPreferredUnit] = React.useState("grams");
  const [editPreferredQuantity, setEditPreferredQuantity] = React.useState("100");
  const [nutritionBasis, setNutritionBasis] = React.useState("100g");
  const [nutritionDraft, setNutritionDraft] = React.useState<NutritionDraft>(emptyNutritionDraft);
  const [editNutrientSource, setEditNutrientSource] = React.useState("usda");
  const [editNutrientDetail, setEditNutrientDetail] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);
  const [editStatus, setEditStatus] = React.useState<string | null>(null);
  const editScrollRef = React.useRef<HTMLDivElement>(null);

  function nutritionDraftFor(f: MyFood, basisGrams: number): NutritionDraft {
    const factor = basisGrams / 100;
    const value = (n: number | null) => n == null ? "" : String(Number((n * factor).toFixed(3)));
    return {
      kcal: value(f.kcal),
      protein_g: value(f.protein_g),
      carbs_g: value(f.carbs_g),
      fat_g: value(f.fat_g),
      fiber_g: value(f.fiber_g),
      sugar_g: value(f.sugar_g),
      sodium_mg: value(f.sodium_mg),
    };
  }

  function closeFoodEditor() {
    setEditFoodId(null);
    setEditStatus(null);
    setEditingServingId(null);
  }

  async function openFoodEditor(f: MyFood) {
    setEditFoodId(f.my_food_id);
    setEditName(f.display_name);
    setEditBrand(f.brand || "");
    setEditPreferredUnit(f.preferred_mode === "serving" && f.preferred_serving_id ? f.preferred_serving_id : "grams");
    setEditPreferredQuantity(String(Number(f.preferred_quantity || 1)));
    setNutritionBasis("100g");
    setNutritionDraft(nutritionDraftFor(f, 100));
    setEditNutrientSource(f.nutrient_source || "manual");
    setEditNutrientDetail(f.nutrient_source_detail || "");
    setEditStatus(null);
    await loadServings(f.my_food_id);
  }

  function changeNutritionBasis(f: MyFood, basis: string) {
    const serving = (servMap[f.my_food_id] || []).find((s) => s.my_food_serving_id === basis);
    const grams = basis === "100g" ? 100 : Number(serving?.grams || 100);
    setNutritionBasis(basis);
    setNutritionDraft(nutritionDraftFor(f, grams));
  }

  async function saveFoodEditor() {
    if (!editFoodId) return;
    const f = myFoods.find((food) => food.my_food_id === editFoodId);
    if (!f) return;

    const name = editName.trim();
    const quantity = Number(editPreferredQuantity);
    if (!name) return setEditStatus("Name is required.");
    if (!Number.isFinite(quantity) || quantity <= 0) return setEditStatus("Preferred quantity must be greater than zero.");

    const serving = (servMap[editFoodId] || []).find((s) => s.my_food_serving_id === nutritionBasis);
    const basisGrams = nutritionBasis === "100g" ? 100 : Number(serving?.grams || 0);
    if (!Number.isFinite(basisGrams) || basisGrams <= 0) return setEditStatus("Choose a valid nutrition basis.");

    const per100 = (value: string) => {
      if (!value.trim()) return null;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) throw new Error("Nutrients must be zero or greater.");
      return (n * 100) / basisGrams;
    };

    setEditSaving(true);
    setEditStatus(null);
    try {
      const preferredServingId = editPreferredUnit === "grams" ? null : editPreferredUnit;
      const updated = await apiJson<MyFood>(
        `/api/lifeswitch/nutrition/my_foods/${encodeURIComponent(editFoodId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            display_name: name,
            brand: editBrand.trim() || null,
            preferred_mode: preferredServingId ? "serving" : "grams",
            preferred_quantity: quantity,
            preferred_serving_id: preferredServingId,
            nutrient_source: editNutrientSource,
            nutrient_source_detail: editNutrientDetail.trim() || null,
            kcal: per100(nutritionDraft.kcal),
            protein_g: per100(nutritionDraft.protein_g),
            carbs_g: per100(nutritionDraft.carbs_g),
            fat_g: per100(nutritionDraft.fat_g),
            fiber_g: per100(nutritionDraft.fiber_g),
            sugar_g: per100(nutritionDraft.sugar_g),
            sodium_mg: per100(nutritionDraft.sodium_mg),
            is_verified: editNutrientSource !== "manual",
          }),
        },
      );
      setMyFoods((rows) => rows.map((row) => row.my_food_id === updated.my_food_id ? updated : row));
      setEditStatus("Saved.");
    } catch (e: any) {
      setEditStatus(String(e?.message || e));
    } finally {
      setEditSaving(false);
    }
  }
  async function loadServings(my_food_id: string) {
    setServErr((p) => ({ ...p, [my_food_id]: null }));
    setServLoading((p) => ({ ...p, [my_food_id]: true }));
    try {
      const r = await authFetch(`/api/lifeswitch/nutrition/my_foods/${encodeURIComponent(my_food_id)}/servings`, { cache: "no-store" });
      const t = await r.text();
      let j: any = null;
      try { j = t ? JSON.parse(t) : null; } catch { }
      if (!r.ok) throw new Error(j?.detail || j?.error || t?.slice(0, 200) || `HTTP ${r.status}`);
      const rows = Array.isArray(j) ? (j as MyFoodServing[]) : [];
      setServMap((p) => ({ ...p, [my_food_id]: rows }));
      return rows;
    } catch (e: any) {
      setServMap((p) => ({ ...p, [my_food_id]: [] }));
      setServErr((p) => ({ ...p, [my_food_id]: String(e?.message || e) }));
      return [];
    } finally {
      setServLoading((p) => ({ ...p, [my_food_id]: false }));
    }
  }

  async function createServing(my_food_id: string) {
    const name = (servName[my_food_id] ?? "").trim();
    const grams = Number((servGrams[my_food_id] ?? "").trim());
    const isPreferred = !!(servPreferred[my_food_id] ?? false);

    if (!name) {
      setServErr((p) => ({ ...p, [my_food_id]: "Serving unit is required." }));
      return;
    }
    if (!Number.isFinite(grams) || grams <= 0) {
      setServErr((p) => ({ ...p, [my_food_id]: "Grams per unit must be greater than zero." }));
      return;
    }

    setServErr((p) => ({ ...p, [my_food_id]: null }));
    setServCreating((p) => ({ ...p, [my_food_id]: true }));
    try {
      const qs = new URLSearchParams({
        name,
        grams: String(grams),
        is_default: isPreferred ? "1" : "0",
      });

      const r = await authFetch(
        `/api/lifeswitch/nutrition/my_foods/${encodeURIComponent(my_food_id)}/servings/create?${qs.toString()}`,
        { method: "POST", cache: "no-store" }
      );
      const t = await r.text();
      let j: any = null;
      try { j = t ? JSON.parse(t) : null; } catch { }
      if (!r.ok) throw new Error(j?.detail || j?.error || t?.slice(0, 200) || `HTTP ${r.status}`);

      await loadServings(my_food_id);
      await loadMyFoods();
      setServName((p) => ({ ...p, [my_food_id]: "" }));
      setServGrams((p) => ({ ...p, [my_food_id]: "" }));
      setServPreferred((p) => ({ ...p, [my_food_id]: false }));
    } catch (e: any) {
      setServErr((p) => ({ ...p, [my_food_id]: String(e?.message || e) }));
    } finally {
      setServCreating((p) => ({ ...p, [my_food_id]: false }));
    }
  }

  async function updateServing(my_food_id: string, serving: MyFoodServing, body: Record<string, unknown>) {
    setServSavingId(serving.my_food_serving_id);
    setServErr((p) => ({ ...p, [my_food_id]: null }));
    try {
      await apiJson(
        `/api/lifeswitch/nutrition/my_foods/${encodeURIComponent(my_food_id)}/servings/${encodeURIComponent(serving.my_food_serving_id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      setEditingServingId(null);
      if (body.set_preferred === true) {
        setEditPreferredUnit(serving.my_food_serving_id);
        setEditPreferredQuantity("1");
      } else if (body.is_active === false && editPreferredUnit === serving.my_food_serving_id) {
        setEditPreferredUnit("grams");
        setEditPreferredQuantity(String(Number(serving.grams)));
      }
      await loadServings(my_food_id);
      await loadMyFoods();
    } catch (e: any) {
      setServErr((p) => ({ ...p, [my_food_id]: String(e?.message || e) }));
    } finally {
      setServSavingId(null);
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

  const searchBarcode = React.useCallback(async (code?: string) => {
    const upc = String(code ?? barcodeQ).replace(/\D+/g, "").trim();
    if (!upc) {
      setUsdaErr("enter a UPC/barcode number");
      setUsdaRows([]);
      return;
    }

    setUsdaLoading(true);
    setUsdaErr(null);

    try {
      const url = `/api/catalog/foods/usda/barcode?upc=${encodeURIComponent(upc)}&limit=5`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`barcode lookup HTTP ${r.status}: ${t.slice(0, 200)}`);
      }

      const j = await r.json();
      const candidates = Array.isArray(j?.candidates) ? (j.candidates as UsdaHit[]) : [];
      setUsdaRows(candidates);

      if (!candidates.length) {
        setUsdaErr("No USDA barcode match found. Try the description search instead.");
      }
    } catch (e: any) {
      setUsdaErr(String(e?.message || e));
      setUsdaRows([]);
    } finally {
      setUsdaLoading(false);
    }
  }, [barcodeQ]);
  function clearLookup() {
    setUsdaQ("");
    setBarcodeQ("");
    setUsdaRows([]);
    setUsdaErr(null);
    setImportingFdc(null);
  }

  const loadMyFoods = React.useCallback(async () => {
    setMyLoading(true);
    setMyErr(null);

    try {
      const r = await authFetch("/api/lifeswitch/nutrition/my_foods", { cache: "no-store" });
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
  }, []);

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
    const confirmed = await confirmAction({
      title: `Delete ${name}?`,
      description: "This removes the food from your library.",
      confirmLabel: "Delete food",
    });
    if (!confirmed) return;

    try {
      await authFetch(`/api/lifeswitch/nutrition/my_foods/${encodeURIComponent(my_food_id)}/deactivate`, {
        method: "POST",
        cache: "no-store",
      });
      closeFoodEditor();
      await loadMyFoods();
    } catch (e: any) {
      setMyErr(String(e?.message || e));
    }
  }

  return (

    <div className="mx-auto max-w-5xl p-4">

      <div className="flex flex-col gap-3 lg:flex-row [@media(pointer:coarse)]:flex-col lg:items-start lg:justify-between">
        <div className="min-w-0" />
      </div>

      <div className="mt-5 grid gap-6">
          {/* ADD FOOD */}
          <LifeSwitchToolPanel
            title="Add food"
            subtitle="Search USDA foods or scan a packaged product."
            storageKey="lifeswitch:nutrition:foods-library-actions"
            defaultOpen={false}
          >
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border" role="tablist" aria-label="Food lookup method">
              <button
                type="button"
                role="tab"
                aria-selected={lookupMode === "description"}
                className={`min-h-12 px-3 text-sm font-medium ${lookupMode === "description" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/20"}`}
                onClick={() => setLookupMode("description")}
              >
                Describe food
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={lookupMode === "barcode"}
                className={`min-h-12 border-l px-3 text-sm font-medium ${lookupMode === "barcode" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/20"}`}
                onClick={() => setLookupMode("barcode")}
              >
                Barcode
              </button>
            </div>

            <div className="mt-4 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
              {lookupMode === "description" ? (
                <div className="rounded-xl border bg-background/40 p-4">
                  <label htmlFor="nutrition-food-description" className="text-sm font-semibold text-foreground">
                    Search USDA foods
                  </label>
                  <div className="mt-1">
                    Include the food, brand, package, cooked/raw state, or serving details.
                  </div>
                  <input
                    id="nutrition-food-description"
                    className="mt-3 min-h-12 w-full min-w-0 max-w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground"
                    value={usdaQ}
                    onChange={(e) => setUsdaQ(e.target.value)}
                    placeholder="Example: Fairlife 30g protein, 14 oz bottle"
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
                    className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-blue-500/60 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                    onClick={() => void searchUsda()}
                    disabled={usdaLoading || !usdaQ.trim()}
                  >
                    <Search className="h-4 w-4" />
                    {usdaLoading ? "Finding matches…" : "Find matches"}
                  </button>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-2 text-blue-500">
                        <Camera className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">Scan a product barcode</div>
                        <div className="mt-1">Use your phone’s rear camera to find the packaged food.</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-blue-500/60 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                      onClick={() => setScannerOpen(true)}
                    >
                      <Camera className="h-4 w-4" /> Open camera scanner
                    </button>
                  </div>

                  <div className="rounded-xl border bg-background/40 p-4">
                    <label htmlFor="nutrition-food-barcode" className="text-sm font-semibold text-foreground">
                      Enter barcode manually
                    </label>
                    <input
                      id="nutrition-food-barcode"
                      className="mt-3 min-h-12 w-full min-w-0 max-w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground"
                      value={barcodeQ}
                      onChange={(e) => setBarcodeQ(e.target.value)}
                      placeholder="UPC or barcode number"
                      inputMode="numeric"
                      autoCapitalize="none"
                      autoCorrect="off"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void searchBarcode();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="mt-3 min-h-12 w-full rounded-xl border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30 disabled:opacity-50"
                      onClick={() => void searchBarcode()}
                      disabled={usdaLoading || !barcodeQ.trim()}
                    >
                      {usdaLoading ? "Looking up barcode…" : "Look up barcode"}
                    </button>
                  </div>
                </div>
              )}

              {usdaQ.trim() || barcodeQ.trim() || usdaRows.length || usdaErr ? (
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted/30"
                  onClick={clearLookup}
                >
                  Clear lookup
                </button>
              ) : null}
            </div>

            {(!usdaLoading && usdaRows.length === 0 && (usdaQ.trim() || barcodeQ.trim()) && !usdaErr) ? (
              <div className="mt-3 text-xs text-muted-foreground">
                No matches found.
              </div>
            ) : null}

            {usdaErr ? (
              <div role="alert" className="mt-3 border-l-2 border-red-500/60 bg-red-500/5 py-2 pl-3 text-xs text-red-500">
                {usdaErr}
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
                            className="min-h-11 w-full rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50 lg:w-auto"
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
            <button className="min-h-11 rounded-md border px-3 py-1.5 text-xs sm:min-h-0" onClick={() => void loadMyFoods()} disabled={myLoading}>
              {myLoading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {myErr ? <div role="alert" className="mt-2 border-l-2 border-red-500/60 bg-red-500/5 py-2 pl-3 text-xs text-red-500">{myErr}</div> : null}

          <div className="mt-3 divide-y divide-muted/20">
            {myFoods.map((f) => {
              const g = f.preferred_mode === "serving"
                ? Number(f.preferred_serving_grams || 0) * Number(f.preferred_quantity || 0)
                : Number(f.preferred_quantity || 0);
              const kcal = scaledFromPer100(f.kcal, g);
              const p = scaledFromPer100(f.protein_g, g);
              const c = scaledFromPer100(f.carbs_g, g);
              const fat = scaledFromPer100(f.fat_g, g);
              const preferredLabel = f.preferred_mode === "serving" && f.preferred_serving_name
                ? `${fmtQty(f.preferred_quantity)} × ${f.preferred_serving_name} · ${fmt(g, 1)}g`
                : `${fmtQty(f.preferred_quantity)}g`;

              return (
                <button
                  key={f.my_food_id}
                  type="button"
                  className="w-full py-3 text-left active:bg-muted/20"
                  onClick={() => void openFoodEditor(f)}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-blue-400 break-words whitespace-normal">{f.display_name}</div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{f.brand || "Unbranded"}</span>
                      {f.variant ? ` · ${f.variant}` : ""}
                      {f.source_type === "usda" ? (
                        <span className="text-[10px] font-medium uppercase tracking-wide">USDA</span>
                      ) : null}
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
                      {preferredLabel} · kcal {fmt(kcal, 0)} · P {fmt(p, 1)} · C {fmt(c, 1)} · F {fmt(fat, 1)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Edit modal */}
          {editFoodId ? (() => {
            const f = myFoods.find((x) => x.my_food_id === editFoodId);
            if (!f) return null;
            const servings = servMap[f.my_food_id] || [];

            return (
              <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:items-center">
                <div
                  ref={editScrollRef}
                  className="max-h-[calc(100svh-1.5rem-env(safe-area-inset-bottom))] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-background p-4 sm:max-h-[92vh]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">Edit food</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{f.display_name}</div>
                    </div>
                    <button className="rounded-md border px-2 py-1 text-xs hover:bg-muted/30" onClick={closeFoodEditor}>
                      Close
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <section className="rounded-xl border p-3">
                      <div className="text-sm font-semibold">Food</div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs text-muted-foreground">
                          Name
                          <input
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        </label>
                        <label className="grid gap-1 text-xs text-muted-foreground">
                          Brand
                          <input
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground"
                            value={editBrand}
                            onChange={(e) => setEditBrand(e.target.value)}
                            placeholder="Optional"
                          />
                        </label>
                      </div>
                    </section>

                    <section className="rounded-xl border p-3">
                      <div className="text-sm font-semibold">Preferred logging quantity</div>
                      <div className="mt-1 text-xs text-muted-foreground">This is what Capture selects first.</div>
                      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
                        <NumericInput
                          className="min-w-0 rounded-xl border bg-background px-3 py-2 text-sm"
                          value={editPreferredQuantity}
                          mode="decimal"
                          min={0.001}
                          required
                          onValueChange={setEditPreferredQuantity}
                          aria-label="Preferred quantity"
                        />
                        <select
                          className="min-w-0 rounded-xl border bg-background px-3 py-2 text-sm"
                          value={editPreferredUnit}
                          onChange={(e) => {
                            setEditPreferredUnit(e.target.value);
                            if (e.target.value !== "grams") setEditPreferredQuantity("1");
                          }}
                          aria-label="Preferred unit"
                        >
                          <option value="grams">grams</option>
                          {servings.map((sv) => (
                            <option key={sv.my_food_serving_id} value={sv.my_food_serving_id}>
                              {sv.name} · {fmt(sv.grams, 1)}g
                            </option>
                          ))}
                        </select>
                      </div>
                    </section>

                    <section className="rounded-xl border p-3">
                      <div className="text-sm font-semibold">Nutrition facts</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Enter the values exactly as shown on USDA or the package label.
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs text-muted-foreground">
                          Values are for
                          <select
                            className="rounded-xl border bg-background px-3 py-2 text-sm text-foreground"
                            value={nutritionBasis}
                            onChange={(e) => changeNutritionBasis(f, e.target.value)}
                          >
                            <option value="100g">100 grams</option>
                            {servings.map((sv) => (
                              <option key={sv.my_food_serving_id} value={sv.my_food_serving_id}>
                                1 {sv.name} · {fmt(sv.grams, 1)}g
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs text-muted-foreground">
                          Source
                          <select
                            className="rounded-xl border bg-background px-3 py-2 text-sm text-foreground"
                            value={editNutrientSource}
                            onChange={(e) => setEditNutrientSource(e.target.value)}
                          >
                            <option value="usda">USDA</option>
                            <option value="label">Nutrition label</option>
                            <option value="manual">Manual</option>
                          </select>
                        </label>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {([
                          ["kcal", "Calories"],
                          ["protein_g", "Protein (g)"],
                          ["carbs_g", "Carbs (g)"],
                          ["fat_g", "Fat (g)"],
                          ["fiber_g", "Fiber (g)"],
                          ["sugar_g", "Sugar (g)"],
                          ["sodium_mg", "Sodium (mg)"],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="grid gap-1 text-xs text-muted-foreground">
                            {label}
                            <NumericInput
                              className="min-w-0 rounded-lg border bg-background px-2 py-2 text-sm text-foreground"
                              value={nutritionDraft[key]}
                              mode="decimal"
                              min={0}
                              onValueChange={(value) => setNutritionDraft((draft) => ({ ...draft, [key]: value }))}
                            />
                          </label>
                        ))}
                      </div>

                      <label className="mt-3 grid gap-1 text-xs text-muted-foreground">
                        Source note
                        <input
                          className="rounded-xl border bg-background px-3 py-2 text-sm text-foreground"
                          value={editNutrientDetail}
                          onChange={(e) => setEditNutrientDetail(e.target.value)}
                          placeholder="Optional, e.g. package label checked July 2026"
                        />
                      </label>
                    </section>

                    <section className="rounded-xl border p-3">
                      <div className="text-sm font-semibold">Serving units</div>
                      <div className="mt-1 text-xs text-muted-foreground">Each unit resolves to grams for calculations.</div>

                      {servErr[f.my_food_id] ? <div role="alert" className="mt-2 text-xs text-red-500">{servErr[f.my_food_id]}</div> : null}
                      {servLoading[f.my_food_id] ? <div className="mt-2 text-xs text-muted-foreground">Loading…</div> : null}

                      <div className="mt-3 space-y-2">
                        {servings.map((sv) => editingServingId === sv.my_food_serving_id ? (
                          <div key={sv.my_food_serving_id} className="grid gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_8rem_auto]">
                            <input
                              className="rounded-lg border bg-background px-2 py-1.5 text-sm"
                              value={editingServingName}
                              onChange={(e) => setEditingServingName(e.target.value)}
                              aria-label="Serving name"
                            />
                            <NumericInput
                              className="rounded-lg border bg-background px-2 py-1.5 text-sm"
                              value={editingServingGrams}
                              mode="decimal"
                              min={0.001}
                              required
                              onValueChange={setEditingServingGrams}
                              aria-label="Serving grams"
                            />
                            <div className="flex gap-1">
                              <button
                                className="rounded-lg border px-2 py-1 text-xs"
                                disabled={servSavingId === sv.my_food_serving_id}
                                onClick={() => void updateServing(f.my_food_id, sv, {
                                  name: editingServingName,
                                  grams: Number(editingServingGrams),
                                })}
                              >Save</button>
                              <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => setEditingServingId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div key={sv.my_food_serving_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2 text-xs">
                            <div>
                              <span className="font-medium">{sv.name}</span>
                              <span className="text-muted-foreground"> · {fmt(sv.grams, 1)}g</span>
                              {f.preferred_serving_id === sv.my_food_serving_id ? (
                                <span className="ml-2 rounded-full border px-1.5 py-0.5 text-[10px]">Preferred</span>
                              ) : null}
                            </div>
                            <div className="flex gap-1">
                              {f.preferred_serving_id !== sv.my_food_serving_id ? (
                                <button className="rounded-lg border px-2 py-1" onClick={() => void updateServing(f.my_food_id, sv, { set_preferred: true })}>Use</button>
                              ) : null}
                              <button
                                className="rounded-lg border px-2 py-1"
                                onClick={() => {
                                  setEditingServingId(sv.my_food_serving_id);
                                  setEditingServingName(sv.name);
                                  setEditingServingGrams(String(Number(sv.grams)));
                                }}
                              >Edit</button>
                              <button
                                className="rounded-lg px-2 py-1 text-red-500 hover:bg-red-500/10"
                                onClick={() => {
                                  void (async () => {
                                    const confirmed = await confirmAction({
                                      title: `Remove ${sv.name}?`,
                                      description: "This serving unit will no longer be available for logging.",
                                      confirmLabel: "Remove unit",
                                    });
                                    if (confirmed) {
                                      void updateServing(f.my_food_id, sv, { is_active: false });
                                    }
                                  })();
                                }}
                                aria-label={`Remove ${sv.name} serving unit`}
                              >Remove unit</button>
                            </div>
                          </div>
                        ))}
                        {!servings.length && !servLoading[f.my_food_id] ? (
                          <div className="text-xs text-muted-foreground">No natural units yet. Grams remain available.</div>
                        ) : null}
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                        <input
                          className="min-w-0 rounded-xl border bg-background px-3 py-2 text-sm"
                          value={servName[f.my_food_id] ?? ""}
                          onChange={(e) => setServName((p) => ({ ...p, [f.my_food_id]: e.target.value }))}
                          placeholder="Unit, e.g. slice or bottle"
                        />
                        <NumericInput
                          className="min-w-0 rounded-xl border bg-background px-3 py-2 text-sm"
                          value={servGrams[f.my_food_id] ?? ""}
                          mode="decimal"
                          min={0.001}
                          onValueChange={(value) => setServGrams((p) => ({ ...p, [f.my_food_id]: value }))}
                          placeholder="grams/unit"
                        />
                        <button
                          className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                          onClick={() => void createServing(f.my_food_id)}
                          disabled={!!servCreating[f.my_food_id]}
                        >
                          {servCreating[f.my_food_id] ? "Adding…" : "Add"}
                        </button>
                      </div>

                      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={!!servPreferred[f.my_food_id]}
                          onChange={(e) => setServPreferred((p) => ({ ...p, [f.my_food_id]: e.target.checked }))}
                        />
                        Make this the preferred logging unit
                      </label>
                    </section>

                    <details className="rounded-xl border p-3">
                      <summary className="cursor-pointer text-sm font-semibold">Source details</summary>
                      <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                        <div>Original name: {f.source_display_name || "—"}</div>
                        <div>Source: {f.source_type === "usda" ? "USDA FoodData Central" : (f.source || f.source_type)}</div>
                        <div>Source ID: {f.source_id || "—"}</div>
                        <div>Barcode: {f.barcode || "—"}</div>
                        <div>Nutrients: {f.nutrient_source}</div>
                        <div>Verified: {f.is_verified ? "yes" : "no"}</div>
                      </div>
                    </details>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="min-h-12 w-full rounded-xl border px-4 py-2 text-sm hover:bg-muted/30 disabled:opacity-50 sm:w-auto"
                        onClick={() => void saveFoodEditor()}
                        disabled={editSaving}
                      >
                        {editSaving ? "Saving…" : "Save changes"}
                      </button>
                      {editStatus ? <div role={editStatus === "Saved." ? "status" : "alert"} className={`text-xs ${editStatus === "Saved." ? "text-muted-foreground" : "text-red-500"}`}>{editStatus}</div> : null}
                    </div>

                    <div className="border-t border-border/50 pt-3">
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10"
                        onClick={() => void deactivateMyFood(f.my_food_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete food
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : null}
          <BarcodeScanner
            open={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onDetected={(code) => {
              setBarcodeQ(code);
              setScannerOpen(false);
              void searchBarcode(code);
            }}
          />
        </div>
      </div>
    </div>
  );
}
