import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getLifeSwitchOwnerUserId, injectOwnerUserId, unauthorizedLifeSwitch } from "@/app/api/lifeswitch/_owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

async function proxy(req: NextRequest, method: "POST" | "PATCH" | "DELETE") {
  const rid = req.headers.get("x-request-id") || randomUUID();

  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const inUrl = new URL(req.url);
  const upstream = new URL(`${BRAINS_URL}/lifeswitch/nutrition/log/entry`);
  upstream.search = inUrl.search;
  injectOwnerUserId(upstream, owner_user_id);

  let body: string | undefined = undefined;

  if (method === "POST") {
    const raw = await req.text().catch(() => "");
    let parsed: any = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }

    parsed.owner_user_id = owner_user_id;
    body = JSON.stringify(parsed);
  }

  const r = await fetch(upstream.toString(), {
    method,
    headers: {
      "x-request-id": rid,
      ...(method === "POST"
        ? { "content-type": "application/json; charset=utf-8" }
        : {}),
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

export async function POST(req: NextRequest) {
  return proxy(req, "POST");
}

export async function PATCH(req: NextRequest) {
  return proxy(req, "PATCH");
}

export async function DELETE(req: NextRequest) {
  return proxy(req, "DELETE");
}
