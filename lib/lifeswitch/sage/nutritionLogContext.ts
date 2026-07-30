import { lifeSwitchUpstreamHeaders } from "@/app/api/lifeswitch/_owner";
import {
  projectNutritionLogSageContext,
  type NutritionLogSageContext,
  type NutritionSourceState,
} from "./nutritionLogProjection";

const MAX_UPSTREAM_BYTES = 2 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 15_000;

type UpstreamResult =
  | Readonly<{ ok: true; status: number; value: unknown }>
  | Readonly<{
      ok: false;
      status: number;
      state: Exclude<NutritionSourceState, "ready" | "missing">;
    }>;

export type NutritionLogContextResult =
  | Readonly<{ ok: true; context: NutritionLogSageContext }>
  | Readonly<{ ok: false; status: 403; code: "nutrition_view_required" }>;

function brainsUrl(): string {
  return (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(
    /\/+$/,
    "",
  );
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sourceState(result: UpstreamResult): NutritionSourceState {
  return result.ok ? "ready" : result.state;
}

async function fetchJson(
  path: string,
  query: Readonly<Record<string, string>>,
  requestId: string,
  actorUserId: string,
  timezone: string,
  parentSignal: AbortSignal,
): Promise<UpstreamResult> {
  const url = new URL(`${brainsUrl()}${path}`);
  for (const [name, value] of Object.entries(query)) {
    if (value) url.searchParams.set(name, value);
  }
  const signal = AbortSignal.any([
    parentSignal,
    AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  ]);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: lifeSwitchUpstreamHeaders(requestId, actorUserId, {
        "x-vs-owner-timezone": timezone,
      }),
      cache: "no-store",
      signal,
    });
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: response.status,
        state: "permission_denied",
      };
    }
    if (!response.ok) {
      return { ok: false, status: response.status, state: "unavailable" };
    }
    const declared = Number(response.headers.get("content-length") || "0");
    if (Number.isFinite(declared) && declared > MAX_UPSTREAM_BYTES) {
      return { ok: false, status: 502, state: "invalid_response" };
    }
    const raw = await response.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_UPSTREAM_BYTES) {
      return { ok: false, status: 502, state: "invalid_response" };
    }
    try {
      return {
        ok: true,
        status: response.status,
        value: raw ? JSON.parse(raw) : null,
      };
    } catch {
      return { ok: false, status: 502, state: "invalid_response" };
    }
  } catch {
    return { ok: false, status: 502, state: "unavailable" };
  }
}

function localDay(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

function addDays(day: string, offset: number): string {
  const parsed = new Date(`${day}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + offset);
  return parsed.toISOString().slice(0, 10);
}

function activePlanDocument(value: unknown): unknown {
  const activePlan = record(record(value).active_plan);
  const document = activePlan.document;
  return document && typeof document === "object" && !Array.isArray(document)
    ? document
    : null;
}

function recoveryRows(value: unknown): readonly unknown[] | null {
  const rows = record(value).recovery_adjustments;
  return Array.isArray(rows) ? rows : null;
}

export async function buildNutritionLogSageContext({
  actorUserId,
  targetUserId,
  requestId,
  timezone,
  signal,
}: Readonly<{
  actorUserId: string;
  targetUserId: string | null;
  requestId: string;
  timezone: string;
  signal: AbortSignal;
}>): Promise<NutritionLogContextResult> {
  const today = localDay(timezone);
  const startDay = addDays(today, -59);
  const targetQuery: Record<string, string> = {};
  if (targetUserId) targetQuery.target_user_id = targetUserId;

  const [range, activePlan, recovery] = await Promise.all([
    fetchJson(
      "/lifeswitch/nutrition/log/range",
      {
        owner_user_id: actorUserId,
        start_day: startDay,
        end_day: today,
        include_entries: "1",
        ...targetQuery,
      },
      requestId,
      actorUserId,
      timezone,
      signal,
    ),
    fetchJson(
      "/lifeswitch/plan/active",
      targetQuery,
      requestId,
      actorUserId,
      timezone,
      signal,
    ),
    fetchJson(
      "/lifeswitch/plan/recovery-adjustments",
      { ...targetQuery, starts_on: today, ends_on: today },
      requestId,
      actorUserId,
      timezone,
      signal,
    ),
  ]);

  if (!range.ok && range.state === "permission_denied") {
    return { ok: false, status: 403, code: "nutrition_view_required" };
  }

  let plan: unknown = null;
  let planState: NutritionSourceState = sourceState(activePlan);
  if (activePlan.ok) {
    plan = activePlanDocument(activePlan.value);
    if (plan) {
      planState = "ready";
    } else {
      const fallback = await fetchJson(
        "/lifeswitch/plan/profile",
        {
          owner_user_id: actorUserId,
          create_if_missing: "0",
          ...targetQuery,
        },
        requestId,
        actorUserId,
        timezone,
        signal,
      );
      if (fallback.ok) {
        const fallbackRecord = record(fallback.value);
        plan = Object.keys(fallbackRecord).length > 0 ? fallback.value : null;
        planState = plan ? "ready" : "missing";
      } else {
        planState = fallback.state;
      }
    }
  }

  const rangeValue =
    range.ok &&
    range.value &&
    typeof range.value === "object" &&
    !Array.isArray(range.value) &&
    Array.isArray(record(range.value).days)
      ? range.value
      : null;
  const rangeState: NutritionSourceState =
    range.ok && rangeValue === null ? "invalid_response" : sourceState(range);
  const recoveryValue = recovery.ok ? recoveryRows(recovery.value) : null;
  const recoveryState: NutritionSourceState =
    recovery.ok && recoveryValue === null
      ? "invalid_response"
      : sourceState(recovery);

  return {
    ok: true,
    context: projectNutritionLogSageContext({
      delegatedView: Boolean(
        targetUserId &&
        targetUserId.toLowerCase() !== actorUserId.toLowerCase(),
      ),
      today,
      startDay,
      endDay: today,
      range: rangeValue,
      rangeState,
      plan,
      planState,
      recoveryAdjustments: recoveryValue,
      recoveryState,
    }),
  };
}
