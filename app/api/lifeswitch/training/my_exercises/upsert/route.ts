import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

export async function POST(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();

  const inUrl = new URL(req.url);
  const upstream = new URL(`${BRAINS_URL}/lifeswitch/training/my_exercises/upsert`);
  upstream.search = inUrl.search; // owner_user_id required

  const body = await req.text().catch(() => "");

  try {
    const r = await fetch(upstream.toString(), {
      method: "POST",
      headers: {
        "x-request-id": rid,
        "content-type": req.headers.get("content-type") || "application/json",
      },
      body,
      cache: "no-store",
    });

    const out = await r.text();

    return new Response(out, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") || "application/json; charset=utf-8",
        "x-request-id": r.headers.get("x-request-id") || rid,
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "brains_unreachable", detail: String(e?.message || e) }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8", "x-request-id": rid },
    });
  }
}
