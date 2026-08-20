import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPSTREAM_BYTES = 1024;

function constantTimeMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function noStore(requestId: string) {
  return {
    "cache-control": "private, no-store, max-age=0, must-revalidate",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    "x-request-id": requestId,
  };
}

export async function GET(request: Request) {
  const requestId = randomUUID();
  const expected = (process.env.VS_SERVICE_TOKEN || "").trim();
  const provided = (
    request.headers.get("x-lifeswitch-release-control") || ""
  ).trim();
  if (!expected || !provided || !constantTimeMatch(provided, expected)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: noStore(requestId) },
    );
  }

  const brainsUrl = (process.env.BRAINS_URL || "").trim().replace(/\/+$/, "");
  if (!brainsUrl) {
    return NextResponse.json(
      { ok: false, error: "release_probe_unavailable" },
      { status: 503, headers: noStore(requestId) },
    );
  }

  try {
    const upstream = await fetch(`${brainsUrl}/readyz`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "x-request-id": requestId,
        "x-vs-service-token": expected,
      },
      signal: AbortSignal.timeout(5000),
    });
    const raw = await upstream.text();
    if (!upstream.ok || Buffer.byteLength(raw, "utf8") > MAX_UPSTREAM_BYTES) {
      throw new Error("upstream_not_ready");
    }
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      Object.keys(value).sort().join(",") !== "ok,postgres" ||
      (value as { ok?: unknown }).ok !== true ||
      (value as { postgres?: unknown }).postgres !== true
    ) {
      throw new Error("upstream_contract_invalid");
    }
    return NextResponse.json(
      { ok: true, frontend: true, backend: true, postgres: true },
      { status: 200, headers: noStore(requestId) },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "release_probe_unavailable" },
      { status: 503, headers: noStore(requestId) },
    );
  }
}
