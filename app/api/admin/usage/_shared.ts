import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
};

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const UUID_PREFIX_PATTERN = /^[0-9a-f-]{1,36}$/i;
export const WINDOWS = new Set([0, 7, 30, 90]);
export const SORTS = new Set([
  "total_tokens_desc",
  "ai_requests_desc",
  "nutrition_days_desc",
  "training_sessions_desc",
  "last_activity_desc",
]);
export const MAX_LIMIT = 50;
export const DEFAULT_LIMIT = 25;
export const MAX_CURSOR_LENGTH = 2_048;
export const MAX_QUERY_LENGTH = 64;
const MAX_UPSTREAM_BYTES = 2 * 1024 * 1024;

export function requestId(req: Request): string {
  const raw = String(
    req.headers.get("x-request-id") ||
      req.headers.get("x-correlation-id") ||
      "",
  ).trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

export function fail(
  status: number,
  error: string,
  correlationId: string,
) {
  return NextResponse.json(
    { ok: false, error },
    {
      status,
      headers: { ...NO_STORE_HEADERS, "x-request-id": correlationId },
    },
  );
}

export async function authorizeUsage(
  req: Request,
  correlationId: string,
): Promise<
  | { ok: true; actorUserId: string }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireFreshCapability(req, "usage_analytics.view");
  if (!auth.ok) {
    return {
      ok: false,
      response: fail(
        auth.status,
        auth.msg || "unauthorized",
        correlationId,
      ),
    };
  }
  const actorUserId = String(auth.auth?.user_id || "").trim();
  if (!UUID_PATTERN.test(actorUserId)) {
    return {
      ok: false,
      response: fail(401, "unauthorized", correlationId),
    };
  }
  return { ok: true, actorUserId };
}

export function parseWindow(
  value: string | null,
  fallback: number,
): number | null {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && WINDOWS.has(parsed) ? parsed : null;
}

export async function brainsUsageJson(
  path: string,
  {
    actorUserId,
    correlationId,
  }: {
    actorUserId: string;
    correlationId: string;
  },
): Promise<{ ok: true; value: any } | { ok: false }> {
  const brainsUrl = (
    process.env.BRAINS_URL || "http://172.31.32.171:8088"
  ).replace(/\/+$/, "");
  try {
    const upstream = await fetch(`${brainsUrl}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: brainsUpstreamHeaders(correlationId, actorUserId, {
        Accept: "application/json",
        "x-vs-authorized-capability": "usage_analytics.view",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) return { ok: false };
    const raw = await upstream.text();
    if (!raw || raw.length > MAX_UPSTREAM_BYTES) return { ok: false };
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function displayRole(raw: unknown): "owner" | "admin" | "member" {
  return raw === "owner" || raw === "admin" ? raw : "member";
}

export type VisibleUsageIdentity = {
  email: string;
  role: "owner" | "admin" | "member";
  last_sign_in_at: string | null;
};

export async function visibleIdentity(
  userId: string,
): Promise<VisibleUsageIdentity | null> {
  if (!UUID_PATTERN.test(userId)) return null;
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user || data.user.id !== userId) return null;
    return {
      email: String(data.user.email || "").slice(0, 320),
      role: displayRole(data.user.app_metadata?.role),
      last_sign_in_at: data.user.last_sign_in_at || null,
    };
  } catch {
    return null;
  }
}

export async function visibleIdentities(
  userIds: string[],
): Promise<Map<string, VisibleUsageIdentity | null>> {
  const unique = [...new Set(userIds)].filter((id) => UUID_PATTERN.test(id));
  if (unique.length > MAX_LIMIT) {
    throw new Error("visible usage identity page exceeds limit");
  }
  const results = new Map<string, VisibleUsageIdentity | null>();
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < unique.length) {
      const index = nextIndex;
      nextIndex += 1;
      const userId = unique[index];
      results.set(userId, await visibleIdentity(userId));
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(5, unique.length) }, () => worker()),
  );
  return results;
}

export function noStoreJson(value: any, correlationId: string) {
  return NextResponse.json(value, {
    headers: { ...NO_STORE_HEADERS, "x-request-id": correlationId },
  });
}
