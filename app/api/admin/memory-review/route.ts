export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import { randomUUID } from "crypto";

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  const auth = await requireFreshCapability(req, "memory_system.view");
  if (!auth.ok) {
    return new Response(auth.msg, {
      status: auth.status,
      headers: { "x-request-id": requestId },
    });
  }

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const actorUserId = String((auth as any).payload?.sub || "").trim();

  if (!actorUserId) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "x-request-id": requestId } }
    );
  }

  const r = await fetch(`${BRAINS}/admin/memory/review-plan`, {
    method: "GET",
    headers: brainsUpstreamHeaders(requestId, actorUserId, { Accept: "application/json" }),
    cache: "no-store",
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: `brains HTTP ${r.status}`, details: txt },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }

  return new NextResponse(txt, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
    },
  });
}
