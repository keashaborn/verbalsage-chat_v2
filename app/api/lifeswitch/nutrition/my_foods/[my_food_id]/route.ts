import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import {
  getLifeSwitchOwnerUserId,
  lifeSwitchUpstreamHeaders,
  unauthorizedLifeSwitch,
} from "@/app/api/lifeswitch/_owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ my_food_id: string }> },
) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const { my_food_id } = await ctx.params;
  const body = await req.text();
  const upstream = `${BRAINS_URL}/lifeswitch/nutrition/my_foods/${encodeURIComponent(my_food_id)}`;
  const r = await fetch(upstream, {
    method: "PATCH",
    headers: lifeSwitchUpstreamHeaders(req, rid, owner_user_id, {
      "content-type": "application/json; charset=utf-8",
    }),
    body,
    cache: "no-store",
  });
  const out = await r.text();
  return new Response(out, {
    status: r.status,
    headers: {
      "content-type": r.headers.get("content-type") || "application/json; charset=utf-8",
      "x-request-id": rid,
    },
  });
}
