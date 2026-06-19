export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "../_auth";
import { randomUUID } from "crypto";


function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}


export async function GET(req: Request) {
  const requestId = getRequestId(req);

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(auth.msg, { status: auth.status, headers: { "x-request-id": requestId } });
  }

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const user_id = String((auth as any).payload?.sub || "") || null;
  if (!user_id) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });

  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") || "50";
  const kinds = url.searchParams.get("kinds"); // optional comma list

  const qs = new URLSearchParams();
  qs.set("limit", limit);
  if (kinds) qs.set("kinds", kinds);

  const r = await fetch(`${BRAINS}/cards/${encodeURIComponent(user_id)}?${qs.toString()}`, {
    method: "GET",
    headers: { "x-request-id": requestId, Accept: "application/json" },
    cache: "no-store",
  });

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
