import { injectOwnerUserId } from "@/app/api/lifeswitch/_owner";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

type Domain = "plan" | "nutrition" | "training" | "measurements" | "unknown";
type Mode = "plan" | "log" | "capture" | "design" | "analyze" | "library" | "session" | "calendar" | "unknown";

const ACTIVE_DOMAINS = new Set(["nutrition", "training", "measurements"]);

function clampInt(raw: string | null, lo: number, hi: number, fallback: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function daysAgo(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return ymd(d);
}

function classifyDomain(route: string): Domain {
  if (/^\/lifeswitch\/plan(?:\/|$)/.test(route)) return "plan";
  const m = String(route || "").match(/^\/lifeswitch\/([^\/?#]+)/);
  const raw = String(m?.[1] || "").toLowerCase();
  if (ACTIVE_DOMAINS.has(raw)) return raw as Domain;
  return "unknown";
}

function classifyMode(route: string): Mode {
  if (/^\/lifeswitch\/plan(?:\/|$)/.test(route)) return "plan";

  const parts = String(route || "").split("/").filter(Boolean);
  const domain = parts[1] || "";
  const mode = parts[2] || "";

  if (!ACTIVE_DOMAINS.has(domain)) return "unknown";

  if (mode === "plan") return "plan";
  if (mode === "log") return "log";
  if (mode === "capture") return "capture";
  if (mode === "design") return "design";
  if (mode === "analyze") return "analyze";
  if (mode === "session") return "session";
  if (mode === "calendar") return "calendar";
  if (["foods", "meals", "meal-plans", "exercises", "workouts"].includes(mode)) return "library";

  return "unknown";
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function firstNumber(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").replace(/,/g, " ").trim();
  if (!raw) return null;
  const m = raw.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function extractNutritionTargets(plan: any) {
  const t = plan?.nutrition_targets || {};
  return {
    calories: firstNumber(t.calories ?? t.target_kcal ?? t.kcal),
    protein_g: firstNumber(t.protein_g ?? t.target_protein_g ?? t.protein),
    raw: t,
  };
}

function extractNutritionTotals(raw: any) {
  const candidates = [raw, raw?.totals, raw?.summary, raw?.day, raw?.data].filter(Boolean);

  function pick(keys: string[]) {
    for (const c of candidates) {
      for (const k of keys) {
        if (c && c[k] != null) return c[k];
      }
    }
    return null;
  }

  const kcal = pick(["kcal", "calories", "kcal_total", "calories_total"]);
  const protein_g = pick(["protein_g", "protein", "protein_total_g"]);
  const carbs_g = pick(["carbs_g", "carbs", "carbohydrates_g", "carbs_total_g"]);
  const fat_g = pick(["fat_g", "fat", "fat_total_g"]);

  if (
    kcal == null &&
    protein_g == null &&
    carbs_g == null &&
    fat_g == null &&
    Array.isArray(raw?.entries) &&
    raw.entries.length
  ) {
    let kk = 0;
    let pp = 0;
    let cc = 0;
    let ff = 0;

    for (const e of raw.entries) {
      if (e?.meal_id) {
        kk += safeNum(e?.meal_kcal, 0);
        pp += safeNum(e?.meal_protein, 0);
        cc += safeNum(e?.meal_carbs, 0);
        ff += safeNum(e?.meal_fat, 0);
        continue;
      }

      const g = safeNum(e?.qty_g, 0);
      if (g <= 0) continue;

      kk += (safeNum(e?.food_kcal_100g, 0) * g) / 100.0;
      pp += (safeNum(e?.food_protein_100g, 0) * g) / 100.0;
      cc += (safeNum(e?.food_carbs_100g, 0) * g) / 100.0;
      ff += (safeNum(e?.food_fat_100g, 0) * g) / 100.0;
    }

    return { kcal: kk, protein_g: pp, carbs_g: cc, fat_g: ff };
  }

  return {
    kcal: kcal == null ? null : safeNum(kcal, 0),
    protein_g: protein_g == null ? null : safeNum(protein_g, 0),
    carbs_g: carbs_g == null ? null : safeNum(carbs_g, 0),
    fat_g: fat_g == null ? null : safeNum(fat_g, 0),
  };
}

function hasNutritionData(raw: any, totals: any) {
  if ((totals.kcal ?? 0) > 0) return true;
  if ((totals.protein_g ?? 0) > 0) return true;
  if ((totals.carbs_g ?? 0) > 0) return true;
  if ((totals.fat_g ?? 0) > 0) return true;

  const candidates = [raw?.entries, raw?.items, raw?.meals, raw?.log, raw?.data?.entries, raw?.result?.entries];
  return candidates.some((x) => Array.isArray(x) && x.length > 0);
}

function latestOf(entries: any[], kind: string) {
  return entries.find((e) => e?.entry_kind === kind) || null;
}

async function fetchJson(path: string, rid: string, owner_user_id: string, params?: Record<string, string>) {
  const upstream = new URL(`${BRAINS_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) upstream.searchParams.set(k, v);
  }
  injectOwnerUserId(upstream, owner_user_id);

  const r = await fetch(upstream.toString(), {
    method: "GET",
    headers: { "x-request-id": rid },
    cache: "no-store",
  });

  const text = await r.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw_text: text };
  }

  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: json?.detail || json?.error || text.slice(0, 500) || `HTTP ${r.status}`,
    };
  }

  return { ok: true, status: r.status, data: json };
}

export async function buildLifeSwitchHelperContext({
  owner_user_id,
  rid,
  route = "/lifeswitch",
  days = 14,
  today = ymd(new Date()),
  startDay,
  target_user_id,
  target_name,
}: {
  owner_user_id: string;
  rid: string;
  route?: string;
  days?: number;
  today?: string;
  startDay?: string;
  target_user_id?: string;
  target_name?: string;
}) {
  days = clampInt(String(days), 7, 90, 14);
  startDay = startDay || daysAgo(days - 1);

  const domain = classifyDomain(route);
  const mode = classifyMode(route);
  const targetUserId = String(target_user_id || "").trim();
  const targetName = String(target_name || "").trim();
  const isDelegatedView = Boolean(targetUserId && targetUserId !== owner_user_id);

  const targetParams: Record<string, string> = isDelegatedView
    ? { target_user_id: targetUserId }
    : {};

  const missing: string[] = [];
  const errors: Record<string, any> = {};

  const planResp = await fetchJson("/lifeswitch/plan/profile", rid, owner_user_id, {
    create_if_missing: isDelegatedView ? "0" : "1",
    ...targetParams,
  });

  const plan = planResp.ok ? planResp.data : null;
  if (!planResp.ok) errors.plan = planResp.error;

  const nutritionTargets = extractNutritionTargets(plan);

  const dayList: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayList.push(ymd(d));
  }
  dayList.sort((a, b) => b.localeCompare(a));

  const nutritionDays = [];
  for (const day of dayList) {
    const rawResp = await fetchJson("/lifeswitch/nutrition/log/day", rid, owner_user_id, { day, ...targetParams });
    if (!rawResp.ok) {
      errors[`nutrition_${day}`] = rawResp.error;
      continue;
    }

    const totals = extractNutritionTotals(rawResp.data);
    const any = hasNutritionData(rawResp.data, totals);
    const calorieHit =
      any &&
      nutritionTargets.calories != null &&
      totals.kcal != null &&
      totals.kcal <= nutritionTargets.calories;
    const proteinHit =
      any &&
      nutritionTargets.protein_g != null &&
      totals.protein_g != null &&
      totals.protein_g >= nutritionTargets.protein_g;

    nutritionDays.push({
      day,
      any,
      ...totals,
      calorieHit,
      proteinHit,
      fullHit:
        any &&
        (nutritionTargets.calories == null || calorieHit) &&
        (nutritionTargets.protein_g == null || proteinHit),
    });
  }

  const nutritionLogged = nutritionDays.filter((d) => d.any);
  const nutritionSummary = {
    windowDays: days,
    loggedDays: nutritionLogged.length,
    averageCalories:
      nutritionLogged.length > 0
        ? Math.round(nutritionLogged.reduce((a, d) => a + safeNum(d.kcal, 0), 0) / nutritionLogged.length)
        : null,
    averageProteinG:
      nutritionLogged.length > 0
        ? Math.round(nutritionLogged.reduce((a, d) => a + safeNum(d.protein_g, 0), 0) / nutritionLogged.length)
        : null,
    daysHitCalories: nutritionDays.filter((d) => d.calorieHit).length,
    daysHitProtein: nutritionDays.filter((d) => d.proteinHit).length,
    daysFullHit: nutritionDays.filter((d) => d.fullHit).length,
    targets: {
      calories: nutritionTargets.calories,
      protein_g: nutritionTargets.protein_g,
    },
    days: nutritionDays,
  };

  if (nutritionLogged.length === 0) missing.push("recent nutrition logs");

  const [strengthResp, conditioningResp] = await Promise.all([
    fetchJson("/lifeswitch/training/sessions", rid, owner_user_id, { limit: "500", ...targetParams }),
    fetchJson("/lifeswitch/training/conditioning_sessions", rid, owner_user_id, { limit: "500", ...targetParams }),
  ]);

  const strengthAll = strengthResp.ok && Array.isArray(strengthResp.data) ? strengthResp.data : [];
  const conditioningAll = conditioningResp.ok && Array.isArray(conditioningResp.data) ? conditioningResp.data : [];

  if (!strengthResp.ok) errors.training_strength = strengthResp.error;
  if (!conditioningResp.ok) errors.training_conditioning = conditioningResp.error;

  const strengthRecent = strengthAll.filter((s: any) => String(s?.day || "") >= startDay && String(s?.day || "") <= today);
  const conditioningRecent = conditioningAll.filter((s: any) => String(s?.day || "") >= startDay && String(s?.day || "") <= today);

  const strengthDays = new Set<string>();
  const conditioningDays = new Set<string>();

  for (const s of strengthRecent) if (s?.day) strengthDays.add(String(s.day));
  for (const c of conditioningRecent) if (c?.day) conditioningDays.add(String(c.day));

  const trainingSummary = {
    windowDays: days,
    strengthSessions: strengthRecent.length,
    conditioningSessions: conditioningRecent.length,
    strengthDays: strengthDays.size,
    conditioningDays: conditioningDays.size,
    trainingDays: new Set([...Array.from(strengthDays), ...Array.from(conditioningDays)]).size,
    sets: strengthRecent.reduce((a: number, x: any) => a + safeNum(x?.set_count, 0), 0),
    volume: strengthRecent.reduce((a: number, x: any) => a + safeNum(x?.volume, 0), 0),
    exercises: strengthRecent.reduce((a: number, x: any) => a + safeNum(x?.exercise_count, 0), 0),
    conditioningMinutes: conditioningRecent.reduce((a: number, x: any) => a + safeNum(x?.duration_min, 0), 0),
    recentStrength: strengthRecent.slice(0, 12),
    recentConditioning: conditioningRecent.slice(0, 12),
  };

  if (strengthRecent.length === 0 && conditioningRecent.length === 0) missing.push("recent training logs");

  const measurementsResp = await fetchJson("/lifeswitch/measurements/entries", rid, owner_user_id, { limit: "250", ...targetParams });
  const measurements = measurementsResp.ok && Array.isArray(measurementsResp.data) ? measurementsResp.data : [];
  if (!measurementsResp.ok) errors.measurements = measurementsResp.error;

  const latestWeight = latestOf(measurements, "weight");
  const latestTape = latestOf(measurements, "tape");
  const latestSkinfolds = latestOf(measurements, "skinfolds");
  const latestScan = latestOf(measurements, "scan");

  const bodyFatPercent =
    latestSkinfolds?.body_fat_percent ??
    latestScan?.body_fat_percent ??
    latestWeight?.body_fat_percent ??
    null;

  const weightValue = latestWeight?.weight_value ?? latestScan?.weight_value ?? null;

  const measurementsSummary = {
    entryCount: measurements.length,
    latestWeight,
    latestTape,
    latestSkinfolds,
    latestScan,
    current: {
      weight: weightValue,
      weight_unit: latestWeight?.weight_unit ?? latestScan?.weight_unit ?? "lb",
      waist: latestTape?.waist_value ?? null,
      abdomen: latestTape?.abdomen_value ?? null,
      body_fat_percent: bodyFatPercent,
      fat_mass:
        weightValue != null && bodyFatPercent != null
          ? Math.round(Number(weightValue) * (Number(bodyFatPercent) / 100) * 10) / 10
          : null,
      lean_mass:
        weightValue != null && bodyFatPercent != null
          ? Math.round((Number(weightValue) - Number(weightValue) * (Number(bodyFatPercent) / 100)) * 10) / 10
          : null,
    },
  };

  if (measurements.length === 0) missing.push("measurement entries");

  return {
    ok: true,
    owner_user_id,
    target_user_id: isDelegatedView ? targetUserId : owner_user_id,
    target_name: isDelegatedView ? targetName || null : null,
    delegated_view: isDelegatedView,
    page: {
      route,
      domain,
      mode,
        },
    window: {
      days,
      startDay,
      today,
        },
    currentPlan: plan,
    recent: {
      nutrition: nutritionSummary,
      training: trainingSummary,
      measurements: measurementsSummary,
        },
    missing,
    errors,
  };
}
