import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getLifeSwitchOwnerUserId, injectOwnerUserId, unauthorizedLifeSwitch, lifeSwitchUpstreamHeaders } from "@/app/api/lifeswitch/_owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

export async function POST(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();

  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const inUrl = new URL(req.url);
  const upstream = new URL(`${BRAINS_URL}/lifeswitch/measurements/entries/create`);
  upstream.search = inUrl.search;
  injectOwnerUserId(upstream, owner_user_id);

  try {
    const bodyIn = await req.text().catch(() => "");
    const r = await fetch(upstream.toString(), {
      method: "POST",
      headers: lifeSwitchUpstreamHeaders(req, rid, owner_user_id, { "content-type": "application/json" }),
      body: bodyIn,
      cache: "no-store",
    });

    const bodyOut = await r.text().catch(() => "");
    return new Response(bodyOut, {
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
