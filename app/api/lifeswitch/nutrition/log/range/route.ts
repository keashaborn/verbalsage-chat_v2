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

export async function GET(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const inUrl = new URL(req.url);
  const upstream = new URL(`${BRAINS_URL}/lifeswitch/nutrition/log/range`);
  upstream.search = inUrl.search;
  injectOwnerUserId(upstream, owner_user_id);

  let r: Response;
  try {
    r = await fetch(upstream.toString(), {
      headers: lifeSwitchUpstreamHeaders(req, rid, owner_user_id),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json(
      { detail: timedOut ? "Nutrition range request timed out" : "Nutrition service unavailable" },
      { status: timedOut ? 504 : 502, headers: { "x-request-id": rid } },
    );
  }

  const body = await r.text();
  return new Response(body, {
    status: r.status,
    headers: {
      "content-type": r.headers.get("content-type") || "application/json; charset=utf-8",
      "x-request-id": rid,
    },
  });
}
