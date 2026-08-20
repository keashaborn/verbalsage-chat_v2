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

export async function POST(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const upstream = new URL(`${BRAINS_URL}/lifeswitch/nutrition/log/entries/batch`);
  injectOwnerUserId(upstream, owner_user_id);
  const body = await req.text();
  const response = await fetch(upstream.toString(), {
    method: "POST",
    headers: {
      ...lifeSwitchUpstreamHeaders(req, rid, owner_user_id),
      "content-type": "application/json",
    },
    body,
    cache: "no-store",
  });
  const responseBody = await response.text().catch(() => "");
  return new Response(responseBody, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
      "x-request-id": rid,
    },
  });
}
