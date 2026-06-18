import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getLifeSwitchOwnerUserId, injectOwnerUserId, unauthorizedLifeSwitch } from "@/app/api/lifeswitch/_owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";

export async function GET(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);
  const inUrl = new URL(req.url);

  const upstream = new URL(`${BRAINS_URL}/lifeswitch/nutrition/meal_plans`);
  // forward query params (owner_user_id)
  for (const [k, v] of inUrl.searchParams.entries()) upstream.searchParams.set(k, v);
  injectOwnerUserId(upstream, owner_user_id);

  const r = await fetch(upstream.toString(), {
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
