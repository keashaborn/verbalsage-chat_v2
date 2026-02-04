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

  const [dbgEnabled, setDbgEnabled] = React.useState(false);
  const [dbgVW, setDbgVW] = React.useState(0);
  const [dbgOverflow, setDbgOverflow] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!dbgEnabled) return;
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return;

    const vw = document.documentElement.clientWidth;
    const docSW = document.documentElement.scrollWidth;
    const bodySW = document.body ? document.body.scrollWidth : 0;

    setDbgVW(vw);

    const offenders: string[] = [];
    const els = Array.from(root.querySelectorAll<HTMLElement>("*"));

    for (const el of els) {
      // ignore debug panel + its children
      if (el.closest('[data-vs-debug="1"]')) continue;

      const cs = window.getComputedStyle(el);
      if (cs.display === "none") continue;

      const r = el.getBoundingClientRect();
      const rightOverflow = r.right - vw;
      const leftOverflow = 0 - r.left;

      if (rightOverflow <= 1 && leftOverflow <= 1) continue;

      const cls = (el.getAttribute("class") || "").replace(/\s+/g, " ").slice(0, 160);
      const txt = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80);

      offenders.push(
        `${el.tagName.toLowerCase()} rect=[${Math.round(r.left)},${Math.round(r.right)}] ovR=${Math.round(
          rightOverflow
        )} ovL=${Math.round(leftOverflow)} cls="${cls}" txt="${txt}"`
      );

      if (offenders.length >= 30) break;
    }

    const header = [`vw=${vw} docSW=${docSW} bodySW=${bodySW}`];
    setDbgOverflow(offenders.length ? [...header, ...offenders] : [...header, "(no rect overflow offenders found)"]);
  }, [dbgEnabled, usdaRows.length, myFoods.length]);

  return (
    <div
      data-vs-debug="1"
      className="mb-3 rounded-xl border p-3 text-[11px] font-mono whitespace-pre-wrap break-words max-w-full overflow-hidden"
    >
      <div className="mb-3 max-w-full break-all rounded-xl border p-2 text-[11px] font-mono opacity-70">
        inner={vw.inner} vv={vw.vv} docClient={vw.docClient} docScroll={vw.docScroll} bodyClient={vw.bodyClient} dpr={vw.dpr}
      </div>
      {dbgEnabled ? (
        <div className="mb-3 rounded-xl border p-3 text-[11px] font-mono whitespace-pre-wrap break-words">
          <div className="mb-2 text-xs font-semibold">overflow debug (vw={dbgVW})</div>
          {dbgOverflow.map((x, i) => (
            <div key={i} className="mt-1">
              {x}
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 lg:flex-row [@media(pointer:coarse)]:flex-col lg:items-start lg:justify-between">
        <div className="min-w-0" />
      </div>

      <div className="mt-5 grid gap-6">
        {/* USDA SEARCH */}
        <div>

          {/* Search (Exercises-style) */}
          <div className="mt-3 grid gap-2 min-w-0">
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
                  className="py-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{h.description || "(no description)"}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground min-w-0 [overflow-wrap:anywhere]">
                      {(h.brand_owner || h.brand_name || "unbranded") + " · " + (h.data_type || "unknown")}{" "}
                      {h.published_date ? " · " + h.published_date : ""} · fdc_id {h.fdc_id}
                    </div>

                    {h.gtin_upc ? (
                      <div className="mt-0.5 text-xs text-muted-foreground min-w-0 [overflow-wrap:anywhere]">
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
            {myFoods.map((f) => (
              <div key={f.my_food_id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{f.display_name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground break-words">
                      {(f.brand ? f.brand : "—")}
                      {f.variant ? ` · ${f.variant}` : ""}
                      {f.source ? ` · ${f.source}` : ""}
                      {f.source_id ? `:${f.source_id}` : ""}
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground">
                      kcal/100g {fmt(f.kcal, 0)} · P {fmt(f.protein_g, 1)}g · C {fmt(f.carbs_g, 1)}g · F {fmt(f.fat_g, 1)}g
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">{f.is_verified ? "verified" : "unverified"}</div>

                    <button
                      className="rounded-xl border px-3 py-1.5 text-xs hover:bg-muted/30"
                      onClick={() => void deactivateMyFood(f.my_food_id)}
                      title="Remove from My Foods"
                    >
                      Delete
                    </button>

                    <button
                      className="rounded-xl border px-3 py-1.5 text-xs hover:bg-muted/30"
                      onClick={() => void toggleServings(f.my_food_id)}
                      title="Serving presets"
                    >
                      {(servOpen[f.my_food_id] ?? false) ? "Hide" : "Servings"}
                    </button>
                  </div>
                </div>

                {(servOpen[f.my_food_id] ?? false) ? (
                  <div className="mt-2">
                    {servErr[f.my_food_id] ? <div className="text-xs text-red-500">{servErr[f.my_food_id]}</div> : null}
                    {servLoading[f.my_food_id] ? <div className="text-xs text-muted-foreground">Loading…</div> : null}

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

                    <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-2">
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
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
