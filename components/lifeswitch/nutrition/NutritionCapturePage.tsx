"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

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

  // per 100g
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;

  is_active: boolean;
};

type LogEntry = {
  nutrition_entry_id: string;
  my_food_id: string | null;
  meal_id: string | null;
  qty_g: number | null;
  sort_order: number | null;

  label: string | null;
  food_kcal_100g: number | null;
  food_protein_100g: number | null;
  food_carbs_100g: number | null;
  food_fat_100g: number | null;

  meal_kcal: number | null;
  meal_protein: number | null;
  meal_carbs: number | null;
  meal_fat: number | null;
};

type DraftEntry = {
  draft_id: string;     // client-side id
  my_food_id: string;
  label: string;        // alias/display_name
  qty_g: number;
  // per 100g
  kcal_100g: number | null;
  p_100g: number | null;
  c_100g: number | null;
  f_100g: number | null;
};

function pad2(n: number) { return n < 10 ? `0${n}` : String(n); }
function todayLocalYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function safeNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function fmt0(x: number | null) {
  if (x == null) return "—";
  return String(Math.round(x));
}

function fmt1(x: number | null) {
  if (x == null) return "—";
  return (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, "");
}

function loadFoodOverrides(): Record<string, FoodOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("vs_food_overrides_v1");
    const j = raw ? JSON.parse(raw) : {};
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

export default function NutritionCapturePage() {
  const [owner, setOwner] = React.useState<string | null>(null);
  const [authErr, setAuthErr] = React.useState<string | null>(null);
  const router = useRouter();
  const [flash, setFlash] = React.useState<string>("");

  const [day, setDay] = React.useState<string>(todayLocalYYYYMMDD());
  const [draft, setDraft] = React.useState<DraftEntry[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  const [foods, setFoods] = React.useState<MyFood[]>([]);
  const [foodsLoading, setFoodsLoading] = React.useState(false);
  const [foodsErr, setFoodsErr] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const [gramsByFood, setGramsByFood] = React.useState<Record<string, string>>({});


  const [status, setStatus] = React.useState<string>("");

  // auth
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/whoami", { cache: "no-store" });
        const j = await r.json().catch(() => null);
        if (!j?.ok) {
          setOwner(null);
          setAuthErr(j?.error || "not signed in");
          return;
        }
        const sub = String(j.sub || "").trim();
        if (!sub) throw new Error("missing sub");
        setOwner(sub);
        setAuthErr(null);
      } catch (e: any) {
        setOwner(null);
        setAuthErr(String(e?.message || e));
      }
    })();
  }, []);

  const overrides = React.useMemo(() => loadFoodOverrides(), [owner]); // reload on sign-in change

  async function loadFoods() {
    if (!owner) return;
    setFoodsLoading(true);
    setFoodsErr(null);
    try {
      const p = new URLSearchParams({ owner_user_id: owner });
      const qq = q.trim();
      if (qq) p.set("q", qq);

      const r = await fetch(`/api/lifeswitch/nutrition/my_foods?${p.toString()}`, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(t.slice(0, 200) || `HTTP ${r.status}`);
      const j = JSON.parse(t);
      const list: MyFood[] = Array.isArray(j) ? j : [];
      const active = list.filter((x) => x && x.is_active);

      // stable ordering: override alias/display_name asc
      active.sort((a, b) => {
        const ao = overrides[a.my_food_id]?.alias?.trim() || a.display_name;
        const bo = overrides[b.my_food_id]?.alias?.trim() || b.display_name;
        return ao.localeCompare(bo);
      });

      setFoods(active);

      // initialize grams inputs from overrides (only if unset)
      setGramsByFood((prev) => {
        const next = { ...(prev || {}) };
        for (const f of active) {
          if (next[f.my_food_id] != null && String(next[f.my_food_id]).trim() !== "") continue;
          const g = overrides[f.my_food_id]?.default_grams;
          if (g && Number.isFinite(g)) next[f.my_food_id] = String(g);
        }
        return next;
      });
    } catch (e: any) {
      setFoods([]);
      setFoodsErr(String(e?.message || e));
    } finally {
      setFoodsLoading(false);
    }
  }


  React.useEffect(() => {
    if (!owner) return;
    void loadFoods();
  }, [owner]);

  const totals = React.useMemo(() => {
    let kcal = 0;
    let p = 0;
    let c = 0;
    let f = 0;

    for (const d of draft) {
      const g = safeNum(d.qty_g) ?? 0;
      if (g <= 0) continue;

      const kk = safeNum(d.kcal_100g);
      const pp = safeNum(d.p_100g);
      const cc = safeNum(d.c_100g);
      const ff = safeNum(d.f_100g);

      if (kk != null) kcal += (kk * g) / 100.0;
      if (pp != null) p += (pp * g) / 100.0;
      if (cc != null) c += (cc * g) / 100.0;
      if (ff != null) f += (ff * g) / 100.0;
    }

    return { kcal, p, c, f };
  }, [draft]);

  async function logFood(my_food_id: string) {
    if (!owner) return;
    setStatus("");
    try {
      const g = Number((gramsByFood[my_food_id] || "").trim());
      if (!Number.isFinite(g) || g <= 0) throw new Error("grams must be > 0");

      const f = foods.find((x) => x.my_food_id === my_food_id);
      if (!f) throw new Error("food not found");

      // prefer alias override if present
      const label = (overrides[my_food_id]?.alias?.trim() || f.display_name || "food").trim();

      const e: DraftEntry = {
        draft_id: crypto.randomUUID(),
        my_food_id,
        label,
        qty_g: g,
        kcal_100g: safeNum(f.kcal),
        p_100g: safeNum(f.protein_g),
        c_100g: safeNum(f.carbs_g),
        f_100g: safeNum(f.fat_g),
      };

      setDraft((prev) => [e, ...(prev || [])]);

      setStatus("drafted");
      setFlash("Added to draft.");
      window.setTimeout(() => setFlash(""), 900);
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

  async function submitDraft() {
    if (!owner) return;
    if (!draft.length) return;

    setSubmitting(true);
    setStatus("");
    try {
      const payload = {
        owner_user_id: owner,
        day,
        entries: draft.map((d, idx) => ({
          my_food_id: d.my_food_id,
          qty_g: d.qty_g,
          sort_order: (idx + 1) * 10,
          notes: "capture_v0",
        })),
      };

      const r = await fetch("/api/lifeswitch/nutrition/log/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(t.slice(0, 200) || `HTTP ${r.status}`);

      setDraft([]);
      setStatus("submitted");
      setFlash("Submitted to log.");
      window.setTimeout(() => setFlash(""), 1200);

      // sanity refresh: confirm it landed (and clear any stale errors)
      try {
        const url = `/api/lifeswitch/nutrition/log/day?owner_user_id=${encodeURIComponent(owner)}&day=${encodeURIComponent(day)}`;
        await fetch(url, { cache: "no-store" });
      } catch { }
      setStatus("");

      // refresh totals from backend
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 overflow-x-hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold">Nutrition · Capture</div>
          <div className="mt-1 text-xs text-muted-foreground break-words whitespace-normal">
            Tap a food, adjust grams if needed, then log.
          </div>
        </div>

        <div className="shrink-0">
          <input
            className="rounded-xl border bg-background px-3 py-2 text-sm"
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
      </div>
      {flash ? (
        <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium">
          {flash}
        </div>
      ) : null}
      {authErr && !owner ? (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
          {authErr}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border p-3">
        <div className="text-sm font-semibold">Totals</div>
        <div className="mt-2 text-sm text-muted-foreground break-words whitespace-normal">
          kcal {fmt0(totals.kcal)} · P {fmt1(totals.p)}g · C {fmt1(totals.c)}g · F {fmt1(totals.f)}g
        </div>
      </div>
      {/* Current submission (draft) */}
      <details className="mt-3 rounded-xl border p-3" open>
        <summary className="cursor-pointer select-none text-sm font-semibold">
          Current submission ({draft.length})
        </summary>

        <div className="mt-3 flex items-center gap-2">
          <button
            className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
            onClick={() => void submitDraft()}
            disabled={!owner || submitting || draft.length === 0}
          >
            {submitting ? "Submitting…" : "Submit to log"}
          </button>

          <div className="text-xs text-muted-foreground">
            {draft.length === 0 ? "Add foods below." : "Edit grams, delete mistakes, then submit."}
          </div>
        </div>

        <div className="mt-3 divide-y divide-muted/20">
          {draft.map((e) => (
            <div key={e.draft_id} className="py-3 flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium break-words whitespace-normal">{e.label}</div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <input
                  className="w-20 rounded-xl border bg-background px-2 py-1.5 text-sm text-right"
                  value={String(e.qty_g)}
                  inputMode="decimal"
                  onChange={(ev) => {
                    const v = Number((ev.currentTarget.value || "").trim());
                    setDraft((prev) =>
                      (prev || []).map((x) =>
                        x.draft_id === e.draft_id ? { ...x, qty_g: Number.isFinite(v) ? v : 0 } : x
                      )
                    );
                  }}
                />
                <div className="text-xs text-muted-foreground">g</div>

                <button
                  className="rounded-md border px-2 py-1 text-xs hover:bg-muted/30"
                  onClick={() => setDraft((prev) => (prev || []).filter((x) => x.draft_id !== e.draft_id))}
                  title="Remove"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {draft.length === 0 ? (
            <div className="py-3 text-sm text-muted-foreground">Nothing queued.</div>
          ) : null}
        </div>
      </details>
      <div className="mt-4 grid gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <input
            className="flex-1 min-w-0 rounded-xl border bg-background px-3 py-2 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="filter foods (optional)"
            onKeyDown={(e) => {
              if (e.key === "Enter") void loadFoods();
            }}
          />
          <button
            className="shrink-0 rounded-xl border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
            onClick={() => void loadFoods()}
            disabled={!owner || foodsLoading}
          >
            {foodsLoading ? "…" : "Refresh"}
          </button>
        </div>

        {foodsErr ? <div className="text-xs text-red-500">{foodsErr}</div> : null}
        {status ? <div className="text-xs text-muted-foreground">{status}</div> : null}

        <div className="divide-y divide-muted/20 rounded-xl border">
          {foods.map((f) => {
            const ov = overrides[f.my_food_id] || {};
            const label = (ov.alias && ov.alias.trim()) ? ov.alias.trim() : f.display_name;
            const grams = gramsByFood[f.my_food_id] ?? "";

            return (
              <div key={f.my_food_id} className="py-3 px-3 flex items-start justify-between gap-3 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium break-words whitespace-normal">{label}</div>
                  <div className="mt-1 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
                    {f.brand ? f.brand : "—"}
                    {f.variant ? ` · ${f.variant}` : ""}
                    {f.source_type ? ` · ${f.source_type}` : ""}
                    {f.source_id ? `:${f.source_id}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground break-words whitespace-normal [overflow-wrap:anywhere]">
                    kcal/100g {fmt0(f.kcal)} · P {fmt1(f.protein_g)} · C {fmt1(f.carbs_g)} · F {fmt1(f.fat_g)}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  <input
                    className="w-24 rounded-xl border bg-background px-2 py-1.5 text-sm text-right"
                    value={grams}
                    onChange={(e) => setGramsByFood((p) => ({ ...(p || {}), [f.my_food_id]: e.target.value }))}
                    inputMode="decimal"
                    placeholder="g"
                  />
                  <button
                    className="w-24 rounded-xl border px-3 py-1.5 text-sm hover:bg-muted/30 disabled:opacity-50"
                    onClick={() => void logFood(f.my_food_id)}
                    disabled={!owner}
                  >
                    Log
                  </button>
                </div>
              </div>
            );
          })}
          {!foods.length ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">No foods.</div>
          ) : null}
        </div>
      </div>


    </div>
  );
}
