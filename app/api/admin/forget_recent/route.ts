export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";


function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}


export async function DELETE(req: Request) {
  const requestId = getRequestId(req);

  const auth = await requireFreshCapability(req, "user_data.forget_recent");
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.msg },
      { status: auth.status, headers: { "x-request-id": requestId } }
    );
  }

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const user_id = String((auth as any).payload?.sub || "");
  if (!user_id) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });

  const url = new URL(req.url);
  const minutes = String(url.searchParams.get("minutes") || "60");

  const r = await fetch(
    `${BRAINS}/user/${encodeURIComponent(user_id)}/recent?minutes=${encodeURIComponent(minutes)}`,
    {
      method: "DELETE",
      headers: brainsUpstreamHeaders(requestId, user_id),
      cache: "no-store",
    }
  );

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    return NextResponse.json(
      { error: `brains HTTP ${r.status}`, details: txt },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }

  return new NextResponse(txt, {
    status: 200,
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
  });
}
