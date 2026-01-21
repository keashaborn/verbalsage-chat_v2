import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ meal_plan_id: string }> }) {
  const rid = _req.headers.get("x-request-id") || randomUUID();
  const { meal_plan_id } = await ctx.params;

  const upstream = `${BRAINS_URL}/lifeswitch/nutrition/meal_plans/${encodeURIComponent(meal_plan_id)}/items`;
  const r = await fetch(upstream, {
    method: "GET",
    headers: { "x-request-id": rid },
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
}
