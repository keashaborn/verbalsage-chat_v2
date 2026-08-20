import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import {
  getLifeSwitchOwnerUserId,
  injectOwnerUserId,
  unauthorizedLifeSwitch,
  lifeSwitchUpstreamHeaders,
} from "@/app/api/lifeswitch/_owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ meal_id: string; meal_item_id: string }> }
) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const { meal_id, meal_item_id } = await ctx.params;
  const incoming = new URL(req.url);
  const upstream = new URL(
    `${BRAINS_URL}/lifeswitch/nutrition/meals/${encodeURIComponent(meal_id)}/items/${encodeURIComponent(meal_item_id)}`
  );
  upstream.search = incoming.search;
  injectOwnerUserId(upstream, owner_user_id);

  const response = await fetch(upstream.toString(), {
    method: "PATCH",
    headers: lifeSwitchUpstreamHeaders(req, rid, owner_user_id),
    cache: "no-store",
  });
  const body = await response.text().catch(() => "");
  return new Response(body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
      "x-request-id": rid,
    },
  });
}
