import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

async function proxy(req: NextRequest, method: "GET" | "DELETE") {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const inUrl = new URL(req.url);

  const upstream = new URL(`${BRAINS_URL}/lifeswitch/nutrition/my_food_overrides`);
  upstream.search = inUrl.search;

  const r = await fetch(upstream.toString(), {
    method,
    headers: { "x-request-id": rid },
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

export async function GET(req: NextRequest) {
  return proxy(req, "GET");
}

export async function DELETE(req: NextRequest) {
  return proxy(req, "DELETE");
}
