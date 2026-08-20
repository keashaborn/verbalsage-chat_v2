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

export async function POST(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const upstream = new URL(`${BRAINS_URL}/lifeswitch/training/sessions/complete`);
  injectOwnerUserId(upstream, owner_user_id);

  const raw = await req.text().catch(() => "");
  if (!raw) {
    return new Response(JSON.stringify({ detail: "JSON body required" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8", "x-request-id": rid },
    });
  }
  const idempotencyKey = req.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) {
    return new Response(JSON.stringify({ detail: "Idempotency-Key header required" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8", "x-request-id": rid },
    });
  }

  try {
    const response = await fetch(upstream.toString(), {
      method: "POST",
      headers: {
        ...lifeSwitchUpstreamHeaders(req, rid, owner_user_id),
        "content-type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: raw,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
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
    return new Response(JSON.stringify({ error: "brains_unreachable", detail: String(error) }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8", "x-request-id": rid },
    });
  }
}
