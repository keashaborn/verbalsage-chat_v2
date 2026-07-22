import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import {
  getLifeSwitchOwnerUserId,
  injectOwnerUserId,
  lifeSwitchUpstreamHeaders,
  unauthorizedLifeSwitch,
} from "@/app/api/lifeswitch/_owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

export async function GET(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const ownerUserId = await getLifeSwitchOwnerUserId(req);
  if (!ownerUserId) return unauthorizedLifeSwitch(rid);

  const incomingUrl = new URL(req.url);
  const upstream = new URL(`${BRAINS_URL}/lifeswitch/training/progression`);
  upstream.search = incomingUrl.search;
  injectOwnerUserId(upstream, ownerUserId);

  try {
    const response = await fetch(upstream.toString(), {
      method: "GET",
      headers: lifeSwitchUpstreamHeaders(rid, ownerUserId),
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
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "brains_unreachable", detail: String(error) }),
      {
        status: 502,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-request-id": rid,
        },
      },
    );
  }
}
