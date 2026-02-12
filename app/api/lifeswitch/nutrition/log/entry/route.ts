import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

async function proxy(req: NextRequest, method: "POST" | "PATCH" | "DELETE") {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const inUrl = new URL(req.url);

  const upstream = new URL(`${BRAINS_URL}/lifeswitch/nutrition/log/entry`);
  upstream.search = inUrl.search;

  const body = method === "POST" ? await req.text() : null;

  const r = await fetch(upstream.toString(), {
    method,
    headers: {
      "x-request-id": rid,
      ...(method === "POST"
        ? { "content-type": req.headers.get("content-type") || "application/json; charset=utf-8" }
        : {}),
    },
    body: body ?? undefined,
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

export async function POST(req: NextRequest) {
  return proxy(req, "POST");
}

export async function PATCH(req: NextRequest) {
  return proxy(req, "PATCH");
}

export async function DELETE(req: NextRequest) {
  return proxy(req, "DELETE");
}
