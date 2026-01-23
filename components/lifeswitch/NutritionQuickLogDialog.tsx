"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";

type Meal = {
  meal_id: string;
  name: string;
  meal_type: string;
};

type MyFood = {
  my_food_id: string;
  display_name: string;
  brand: string | null;
  variant: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  is_active: boolean;
};

type LogDayResp = {
  day: any;
  entries: Array<any>;
};

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetch(url, { cache: "no-store", ...(init || {}) });
  const t = await r.text();
  let j: any = null;
  try {
    j = t ? JSON.parse(t) : null;
  } catch {}
  if (!r.ok) {
    const detail = j?.detail || j?.error || t?.slice(0, 200) || `HTTP ${r.status}`;
    throw new Error(String(detail));
  }
  return j;
}

function todayISO() {
  // local date is fine for UI; server stores date only
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmt(n: number | null, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

export function NutritionQuickLogDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  const [owner, setOwner] = React.useState<string | null>(null);
  const [authErr, setAuthErr] = React.useState<string | null>(null);

  const [day, setDay] = React.useState<string>(todayISO());
  const [mode, setMode] = React.useState<"meal" | "food">("meal");

  const [meals, setMeals] = React.useState<Meal[]>([]);
  const [mealId, setMealId] = React.useState<string>("");

  const [foodQ, setFoodQ] = React.useState<string>("");
  const [foods, setFoods] = React.useState<MyFood[]>([]);
  const [qtyG, setQtyG] = React.useState<string>("100");

  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [dayResp, setDayResp] = React.useState<LogDayResp | null>(null);

  async function loadWhoami() {
    const j = await fetchJson("/api/auth/whoami");
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
  }

  async function loadMeals(uid: string) {
    const j = (await fetchJson(`/api/lifeswitch/nutrition/meals?owner_user_id=${encodeURIComponent(uid)}`)) as any[];
    const rows: Meal[] = (Array.isArray(j) ? j : []).map((x) => ({
      meal_id: x.meal_id,
      name: x.name,
      meal_type: x.meal_type,
    }));
    setMeals(rows);
    if (!mealId && rows.length) setMealId(rows[0].meal_id);
  }

  async function loadDay(uid: string, d: string) {
    const j = (await fetchJson(`/api/lifeswitch/nutrition/log/day?owner_user_id=${encodeURIComponent(uid)}&day=${encodeURIComponent(d)}`)) as LogDayResp;
    setDayResp(j);
  }

  async function searchMyFoods(uid: string, q: string) {
    const qs = new URLSearchParams({ owner_user_id: uid });
    const qq = q.trim();
    if (qq) qs.set("q", qq);
    const j = (await fetchJson(`/api/lifeswitch/nutrition/my_foods?${qs.toString()}`)) as any[];
    const rows: MyFood[] = (Array.isArray(j) ? j : []).filter((x) => x.is_active);
    setFoods(rows);
  }

  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setErr(null);
        await loadWhoami();
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open || !owner) return;
    (async () => {
      try {
        setErr(null);
        await loadMeals(owner);
        await loadDay(owner, day);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, owner]);

  React.useEffect(() => {
    if (!open || !owner) return;
    (async () => {
      try {
        await loadDay(owner, day);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  async function submit() {
    if (!owner) return;
    setSaving(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({
        owner_user_id: owner,
        day,
        sort_order: String((dayResp?.entries?.length || 0) + 1),
      });

      if (mode === "meal") {
        if (!mealId) throw new Error("select a meal");
        qs.set("meal_id", mealId);
      } else {
        const picked = foods[0]?.my_food_id; // user clicks specific row; we’ll wire that later
        throw new Error("select a food row to log (UI wiring next step)");
      }

      await fetchJson(`/api/lifeswitch/nutrition/log/entry?${qs.toString()}`, { method: "POST" });
      await loadDay(owner, day);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  const entryCount = dayResp?.entries?.length || 0;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9998] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[9999] w-[560px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-xl">
          <Dialog.Title className="px-4 pt-4 text-sm font-semibold">Quick Nutrition Log</Dialog.Title>
          <Dialog.Description className="px-4 pt-1 text-xs text-muted-foreground">
            Fast entry for a repeat meal (meal template) or an ad-hoc food (next step).
          </Dialog.Description>

          <div className="px-4 pt-3">
            {authErr ? <div className="rounded-md border p-2 text-xs">Auth: {authErr}</div> : null}
            {err ? <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900">{err}</div> : null}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted-foreground">Day</div>
                <input className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm" value={day} onChange={(e) => setDay(e.target.value)} />
              </div>

              <div>
                <div className="text-xs text-muted-foreground">Mode</div>
                <div className="mt-1 flex gap-2">
                  <button className="w-full rounded-md border px-2 py-2 text-sm" onClick={() => setMode("meal")} disabled={mode === "meal"}>
                    Meal
                  </button>
                  <button className="w-full rounded-md border px-2 py-2 text-sm" onClick={() => setMode("food")} disabled={mode === "food"}>
                    Food
                  </button>
                </div>
              </div>
            </div>

            {mode === "meal" ? (
              <div className="mt-3">
                <div className="text-xs text-muted-foreground">Meal template</div>
                <select className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm" value={mealId} onChange={(e) => setMealId(e.target.value)} disabled={!owner}>
                  <option value="">(select)</option>
                  {meals.map((m) => (
                    <option key={m.meal_id} value={m.meal_id}>
                      {m.meal_type} · {m.name}
                    </option>
                  ))}
                </select>

                <button className="mt-3 w-full rounded-md border px-3 py-2 text-sm" onClick={() => void submit()} disabled={!owner || saving}>
                  {saving ? "Logging…" : "Log Meal"}
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                Food-mode UI wiring is next (picker + grams + click-to-log). Meal logging is ready now.
              </div>
            )}

            <div className="mt-4 rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
              Entries today: <span className="font-semibold">{entryCount}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 px-4 pb-4 pt-3">
            <Dialog.Close asChild>
              <button className="rounded-md border px-3 py-2 text-sm">Close</button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
