import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ meal_id: string; meal_item_id: string }> }
) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const { meal_id, meal_item_id } = await ctx.params;

  const inUrl = new URL(req.url);
  const upstream = new URL(
    `${BRAINS_URL}/lifeswitch/nutrition/meals/${encodeURIComponent(meal_id)}/items/${encodeURIComponent(meal_item_id)}/delete`
  );
  upstream.search = inUrl.search; // forwards owner_user_id

  const r = await fetch(upstream.toString(), {
    method: "POST",
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
