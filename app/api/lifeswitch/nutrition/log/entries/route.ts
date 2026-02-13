import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

export async function POST(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();

  // IMPORTANT: entries -> /log/entries (NOT /log/entry)
  const upstream = new URL(`${BRAINS_URL}/lifeswitch/nutrition/log/entries`);

  const body = await req.text();

  const r = await fetch(upstream.toString(), {
    method: "POST",
    headers: {
      "x-request-id": rid,
      "content-type": req.headers.get("content-type") || "application/json; charset=utf-8",
    },
    body,
    cache: "no-store",
  });

  const out = await r.text().catch(() => "");
  return new Response(out, {
    status: r.status,
    headers: {
      "content-type": r.headers.get("content-type") || "application/json; charset=utf-8",
      "x-request-id": rid,
    },
  });
}
