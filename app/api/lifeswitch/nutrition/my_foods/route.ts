import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getLifeSwitchOwnerUserId, injectOwnerUserId, unauthorizedLifeSwitch, lifeSwitchUpstreamHeaders } from "@/app/api/lifeswitch/_owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";

export async function GET(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const inUrl = new URL(req.url);
  const upstreamUrl = new URL(`${BRAINS_URL}/lifeswitch/nutrition/my_foods`);
  for (const [k, v] of inUrl.searchParams.entries()) upstreamUrl.searchParams.set(k, v);
  injectOwnerUserId(upstreamUrl, owner_user_id);

  try {
    const r = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers: lifeSwitchUpstreamHeaders(req, rid, owner_user_id),
      cache: "no-store",
    });

    const body = await r.text();
    return new Response(body, {
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
