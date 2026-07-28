export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function requestId(req: Request): string {
  const raw = (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    ""
  ).trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

function errorResponse(status: number, error: string, correlationId: string) {
  return NextResponse.json(
    { ok: false, error },
    {
      status,
      headers: { ...NO_STORE_HEADERS, "x-request-id": correlationId },
    },
  );
}

function actorId(auth: any): string | null {
  const value = String(auth?.payload?.sub || "").trim();
  return UUID_PATTERN.test(value) ? value : null;
}

function brainsUrl(): string {
  return (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(
    /\/+$/,
    "",
  );
}

export async function GET(req: Request) {
  const correlationId = requestId(req);
  const auth = await requireFreshCapability(req, "memory_system.view");
  if (!auth.ok) {
    return errorResponse(
      auth.status,
      auth.msg || "unauthorized",
      correlationId,
    );
  }
  const actorUserId = actorId(auth);
  if (!actorUserId) {
    return errorResponse(401, "unauthorized", correlationId);
  }

  const incoming = new URL(req.url);
  const upstream = new URL(`${brainsUrl()}/admin/memory/workbench`);
  for (const key of [
    "state",
    "limit",
    "before_created_at",
    "before_packet_id",
  ]) {
    const value = incoming.searchParams.get(key);
    if (value) upstream.searchParams.set(key, value);
  }

  try {
    const response = await fetch(upstream, {
      method: "GET",
      cache: "no-store",
      headers: brainsUpstreamHeaders(correlationId, actorUserId, {
        Accept: "application/json",
        "x-vs-authorized-capability": "memory_system.view",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => null);
    if (
      !response.ok ||
      !payload?.ok ||
      payload?.schema !== "admin_memory_workbench_v1" ||
      payload?.scope !== "current_actor"
    ) {
      return errorResponse(
        response.status === 400 ? 400 : 502,
        "memory_workbench_unavailable",
        correlationId,
      );
    }
    return NextResponse.json(payload, {
      headers: { ...NO_STORE_HEADERS, "x-request-id": correlationId },
    });
  } catch {
    return errorResponse(502, "memory_workbench_unavailable", correlationId);
  }
}

export async function POST(req: Request) {
  const correlationId = requestId(req);
  const auth = await requireFreshCapability(req, "memory_system.manage");
  if (!auth.ok) {
    return errorResponse(
      auth.status,
      auth.msg || "unauthorized",
      correlationId,
    );
  }
  const actorUserId = actorId(auth);
  if (!actorUserId) {
    return errorResponse(401, "unauthorized", correlationId);
  }

  const body = await req.json().catch(() => null);
  const operationId = String(body?.operation_id || "").trim();
  const packetId = String(body?.packet_id || "").trim();
  const packetSha = String(body?.packet_storage_sha256 || "").trim();
  const decision = String(body?.decision || "").trim();
  const diagnosticNote =
    typeof body?.diagnostic_note === "string"
      ? body.diagnostic_note.trim()
      : "";
  if (
    !UUID_PATTERN.test(operationId) ||
    !UUID_PATTERN.test(packetId) ||
    !SHA256_PATTERN.test(packetSha) ||
    !["correct", "not_correct"].includes(decision) ||
    diagnosticNote.length > 2000
  ) {
    return errorResponse(400, "invalid_memory_workbench_feedback", correlationId);
  }

  try {
    const response = await fetch(
      `${brainsUrl()}/admin/memory/workbench/feedback`,
      {
        method: "POST",
        cache: "no-store",
        headers: brainsUpstreamHeaders(correlationId, actorUserId, {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-vs-authorized-capability": "memory_system.manage",
        }),
        body: JSON.stringify({
          operation_id: operationId,
          packet_id: packetId,
          packet_storage_sha256: packetSha,
          decision,
          diagnostic_note: diagnosticNote || null,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const payload = await response.json().catch(() => null);
    if (
      !response.ok ||
      !payload?.ok ||
      payload?.schema !== "admin_memory_workbench_v1" ||
      payload?.scope !== "current_actor"
    ) {
      return errorResponse(
        response.status === 409 ? 409 : response.status === 400 ? 400 : 502,
        response.status === 409
          ? "memory_workbench_feedback_conflict"
          : "memory_workbench_feedback_unavailable",
        correlationId,
      );
    }
    return NextResponse.json(payload, {
      headers: { ...NO_STORE_HEADERS, "x-request-id": correlationId },
    });
  } catch {
    return errorResponse(
      502,
      "memory_workbench_feedback_unavailable",
      correlationId,
    );
  }
}
