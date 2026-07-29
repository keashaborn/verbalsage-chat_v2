import { lifeSwitchUpstreamHeaders } from "@/app/api/lifeswitch/_owner";
import {
  projectTrainingCalendarSageContext,
  type TrainingCalendarSageContext,
} from "./trainingCalendarProjection";

const MAX_UPSTREAM_BYTES = 2 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 15_000;

type UpstreamResult =
  | Readonly<{ ok: true; status: number; value: unknown }>
  | Readonly<{
      ok: false;
      status: number;
      state: "permission_denied" | "unavailable" | "invalid_response";
    }>;

export type TrainingCalendarContextResult =
  | Readonly<{ ok: true; context: TrainingCalendarSageContext }>
  | Readonly<{ ok: false; status: 403; code: "training_view_required" }>;

function brainsUrl(): string {
  return (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(
    /\/+$/,
    "",
  );
}

function sourceState(result: UpstreamResult) {
  return result.ok ? ("ready" as const) : result.state;
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

export async function buildTrainingCalendarSageContext({
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
}>): Promise<TrainingCalendarContextResult> {
  const today = localDay(timezone);
  const targetQuery: Record<string, string> = {};
  if (targetUserId) targetQuery.target_user_id = targetUserId;
  const legacyQuery = {
    owner_user_id: actorUserId,
    ...targetQuery,
  };

  const [sessions, conditioning, plan, recovery] = await Promise.all([
    fetchJson(
      "/lifeswitch/training/sessions",
      { ...legacyQuery, limit: "250" },
      requestId,
      actorUserId,
      timezone,
      signal,
    ),
    fetchJson(
      "/lifeswitch/training/conditioning_sessions",
      { ...legacyQuery, limit: "250" },
      requestId,
      actorUserId,
      timezone,
      signal,
    ),
    fetchJson(
      "/lifeswitch/plan/profile",
      { ...legacyQuery, create_if_missing: "0" },
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

  if (
    (!sessions.ok && sessions.state === "permission_denied") ||
    (!conditioning.ok && conditioning.state === "permission_denied")
  ) {
    return { ok: false, status: 403, code: "training_view_required" };
  }

  const sessionsValue =
    sessions.ok && Array.isArray(sessions.value) ? sessions.value : null;
  const conditioningValue =
    conditioning.ok && Array.isArray(conditioning.value)
      ? conditioning.value
      : null;
  const sessionsState =
    sessions.ok && !Array.isArray(sessions.value)
      ? ("invalid_response" as const)
      : sourceState(sessions);
  const conditioningState =
    conditioning.ok && !Array.isArray(conditioning.value)
      ? ("invalid_response" as const)
      : sourceState(conditioning);

  const planState =
    plan.ok && plan.value === null
      ? ("missing" as const)
      : plan.ok && (typeof plan.value !== "object" || Array.isArray(plan.value))
        ? ("invalid_response" as const)
        : sourceState(plan);
  const recoveryRows =
    recovery.ok &&
    recovery.value &&
    typeof recovery.value === "object" &&
    !Array.isArray(recovery.value)
      ? (recovery.value as { recovery_adjustments?: unknown })
          .recovery_adjustments
      : null;
  const recoveryState =
    recovery.ok && !Array.isArray(recoveryRows)
      ? ("invalid_response" as const)
      : sourceState(recovery);

  return {
    ok: true,
    context: projectTrainingCalendarSageContext({
      delegatedView: Boolean(
        targetUserId &&
        targetUserId.toLowerCase() !== actorUserId.toLowerCase(),
      ),
      today,
      sessions: sessionsValue,
      conditioningSessions: conditioningValue,
      sessionsState,
      conditioningState,
      plan: plan.ok ? plan.value : null,
      planState,
      recoveryAdjustments: Array.isArray(recoveryRows) ? recoveryRows : null,
      recoveryState,
    }),
  };
}
