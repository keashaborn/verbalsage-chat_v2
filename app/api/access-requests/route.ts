import { createHash, randomBytes, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const GENERIC_ACCEPTED_MESSAGE =
  "Request received. If access is approved, an invitation will be sent by email.";
const RATE_WINDOW_MS = 60 * 60 * 1_000;
const MAX_REQUESTS_PER_EMAIL = 3;
const MAX_REQUESTS_PER_NETWORK = 12;

type RateBucket = {
  count: number;
  resetAt: number;
};

type AccessRequestBody = {
  email: string;
  fullName: string | null;
  message: string | null;
};

type ExistingAccessRequest = {
  id: string;
  status: "pending" | "approved" | "declined";
  request_count: number | string;
};

const globalRateLimit = globalThis as typeof globalThis & {
  __vsAccessRequestRateBuckets?: Map<string, RateBucket>;
  __vsAccessRequestRatePepper?: string;
};

const rateBuckets =
  globalRateLimit.__vsAccessRequestRateBuckets ||
  (globalRateLimit.__vsAccessRequestRateBuckets = new Map());
const ratePepper =
  globalRateLimit.__vsAccessRequestRatePepper ||
  (globalRateLimit.__vsAccessRequestRatePepper =
    randomBytes(32).toString("hex"));

function acceptedResponse() {
  return NextResponse.json(
    { ok: true, message: GENERIC_ACCEPTED_MESSAGE },
    { status: 202, headers: NO_STORE_HEADERS },
  );
}

function normalizedEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validEmail(value: string): boolean {
  return (
    value.length >= 3 &&
    value.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

async function requestBody(req: Request): Promise<AccessRequestBody | null> {
  const contentType = String(req.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") return null;

  const declaredLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > 4_096) return null;

  const raw = await req.text();
  if (!raw || raw.length > 4_096) return null;

  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const allowedKeys = new Set(["email", "full_name", "message"]);
    if (Object.keys(body).some((key) => !allowedKeys.has(key))) return null;

    const email = normalizedEmail(body.email);
    const fullName =
      typeof body.full_name === "string" ? body.full_name.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!validEmail(email) || fullName.length > 120 || message.length > 1_000) {
      return null;
    }

    return {
      email,
      fullName: fullName || null,
      message: message || null,
    };
  } catch {
    return null;
  }
}

function networkIdentifier(req: Request): string {
  const direct = String(req.headers.get("x-real-ip") || "").trim();
  const forwarded = String(req.headers.get("x-forwarded-for") || "")
    .split(",", 1)[0]
    .trim();
  return (direct || forwarded || "unknown").slice(0, 128);
}

function rateKey(kind: "email" | "network", value: string): string {
  return createHash("sha256")
    .update(`${ratePepper}:${kind}:${value}`)
    .digest("hex");
}

function withinLimit(key: string, maximum: number, now: number): boolean {
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= maximum;
}

function rateLimited(req: Request, email: string): boolean {
  const now = Date.now();
  if (rateBuckets.size > 5_000) {
    for (const [key, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(key);
    }
  }

  const emailAllowed = withinLimit(
    rateKey("email", email),
    MAX_REQUESTS_PER_EMAIL,
    now,
  );
  const networkAllowed = withinLimit(
    rateKey("network", networkIdentifier(req)),
    MAX_REQUESTS_PER_NETWORK,
    now,
  );
  return !emailAllowed || !networkAllowed;
}

async function persistAccessRequest(
  body: AccessRequestBody,
  retryAfterConflict = true,
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("access_requests")
    .select("id, status, request_count")
    .eq("email_normalized", body.email)
    .maybeSingle<ExistingAccessRequest>();
  if (lookupError) throw lookupError;

  const now = new Date().toISOString();
  if (existing) {
    const shouldReopen = existing.status === "declined";
    const { error: updateError } = await admin
      .from("access_requests")
      .update({
        email: body.email,
        requested_name: body.fullName,
        request_message: body.message,
        status: shouldReopen ? "pending" : existing.status,
        request_count: Math.max(1, Number(existing.request_count) || 1) + 1,
        last_requested_at: now,
        updated_at: now,
        ...(shouldReopen
          ? {
              reviewed_at: null,
              reviewed_by: null,
              decision_note: null,
            }
          : {}),
      })
      .eq("id", existing.id);
    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await admin.from("access_requests").insert({
    email: body.email,
    requested_name: body.fullName,
    request_message: body.message,
    status: "pending",
    request_count: 1,
    created_at: now,
    last_requested_at: now,
    updated_at: now,
  });
  if (insertError?.code === "23505" && retryAfterConflict) {
    await persistAccessRequest(body, false);
    return;
  }
  if (insertError) throw insertError;
}

export async function POST(req: Request) {
  const id = randomUUID();
  const body = await requestBody(req);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "invalid_access_request" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (rateLimited(req, body.email)) {
    return acceptedResponse();
  }

  try {
    await persistAccessRequest(body);
    console.info(
      JSON.stringify({
        event: "access_request_received_v1",
        request_id: id,
        at: new Date().toISOString(),
      }),
    );
    return acceptedResponse();
  } catch {
    console.error(
      JSON.stringify({
        event: "access_request_persist_failed_v1",
        request_id: id,
        at: new Date().toISOString(),
      }),
    );
    return NextResponse.json(
      { ok: false, error: "access_request_unavailable" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
