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

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ meal_plan_id: string; meal_plan_item_id: string }> },
  method: "PATCH" | "DELETE",
) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const ownerUserId = await getLifeSwitchOwnerUserId(req);
  if (!ownerUserId) return unauthorizedLifeSwitch(rid);

  const { meal_plan_id, meal_plan_item_id } = await ctx.params;
  const inUrl = new URL(req.url);
  const upstream = new URL(
    `${BRAINS_URL}/lifeswitch/nutrition/meal_plans/${encodeURIComponent(meal_plan_id)}/items/${encodeURIComponent(meal_plan_item_id)}`,
  );
  upstream.search = inUrl.search;
  injectOwnerUserId(upstream, ownerUserId);

  const response = await fetch(upstream.toString(), {
    method,
    headers: lifeSwitchUpstreamHeaders(rid, ownerUserId),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
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

export function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ meal_plan_id: string; meal_plan_item_id: string }> },
) {
  return proxy(req, ctx, "PATCH");
}

export function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ meal_plan_id: string; meal_plan_item_id: string }> },
) {
  return proxy(req, ctx, "DELETE");
}
