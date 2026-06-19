import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getLifeSwitchOwnerUserId, injectOwnerUserId, unauthorizedLifeSwitch } from "@/app/api/lifeswitch/_owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

export async function POST(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();

  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const inUrl = new URL(req.url);
  const upstream = new URL(`${BRAINS_URL}/lifeswitch/training/my_exercises/upsert`);
  upstream.search = inUrl.search;
  injectOwnerUserId(upstream, owner_user_id);

  const raw = await req.text().catch(() => "");
  let body = raw;

  // If body is JSON, also stamp owner_user_id into body defensively.
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") {
      parsed.owner_user_id = owner_user_id;
      body = JSON.stringify(parsed);
    }
  } catch {
    // keep raw body
  }

  try {
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
  } catch (e) {
    return new Response(JSON.stringify({ error: "brains_unreachable", detail: String(e) }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8", "x-request-id": rid },
    });
  }
}
