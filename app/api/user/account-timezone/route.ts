export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  getFreshSupabaseAuthContextFromRequest,
  getSupabaseBearerAuthorizationFromRequest,
} from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

function requestId(req: Request): string {
  const value = (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    crypto.randomUUID()
  ).trim();
  return value.slice(0, 128);
}

async function context(req: Request) {
  const rid = requestId(req);
  const auth = await getFreshSupabaseAuthContextFromRequest(req);
  const authorization = getSupabaseBearerAuthorizationFromRequest(req);
  if (!auth || !authorization) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "x-request-id": rid } },
    );
  }
  return {
    actor: auth.user_id,
    authorization,
    brains: process.env.BRAINS_URL || "http://172.31.32.171:8088",
    rid,
  };
}

function value(raw: any) {
  return {
    contract_version: "lifeswitch_account_timezone_v1",
    timezone_name:
      typeof raw?.timezone_name === "string" ? raw.timezone_name : null,
    source: typeof raw?.source === "string" ? raw.source : null,
    revision: Number.isInteger(raw?.revision) ? raw.revision : 0,
    updated_at: typeof raw?.updated_at === "string" ? raw.updated_at : null,
    changed: raw?.changed === true,
  };
}

async function proxy(req: Request, method: "GET" | "PUT") {
  const resolved = await context(req);
  if (resolved instanceof NextResponse) return resolved;

  let body: string | undefined;
  if (method === "PUT") {
    const raw = await req.json().catch(() => null);
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      typeof raw.timezone_name !== "string" ||
      raw.timezone_name.length < 1 ||
      raw.timezone_name.length > 80 ||
      !Number.isInteger(raw.expected_revision) ||
      raw.expected_revision < 0
    ) {
      return NextResponse.json(
        { error: "invalid_timezone_request" },
        { status: 400, headers: { "x-request-id": resolved.rid } },
      );
    }
    body = JSON.stringify({
      timezone_name: raw.timezone_name,
      expected_revision: raw.expected_revision,
    });
  }

  const response = await fetch(`${resolved.brains}/lifeswitch/account/timezone`, {
    method,
    headers: brainsUpstreamHeaders(resolved.rid, resolved.actor, {
      authorization: resolved.authorization,
      "content-type": "application/json",
    }),
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  if (!response) {
    return NextResponse.json(
      { error: "timezone_service_unavailable" },
      { status: 503, headers: { "x-request-id": resolved.rid } },
    );
  }
  const raw = await response.text().catch(() => "");
  if (!response.ok) {
    let error = "timezone_service_unavailable";
    try {
      error = String(JSON.parse(raw)?.detail || error);
    } catch {}
    return NextResponse.json(
      { error },
      { status: response.status, headers: { "x-request-id": resolved.rid } },
    );
  }
  try {
    return NextResponse.json(value(JSON.parse(raw)), {
      headers: { "x-request-id": resolved.rid },
    });
  } catch {
    return NextResponse.json(
      { error: "invalid_timezone_response" },
      { status: 502, headers: { "x-request-id": resolved.rid } },
    );
  }
}

export async function GET(req: Request) {
  return proxy(req, "GET");
}

export async function PUT(req: Request) {
  return proxy(req, "PUT");
}
