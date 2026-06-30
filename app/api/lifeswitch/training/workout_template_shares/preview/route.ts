import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { lifeSwitchUpstreamHeaders } from "@/app/api/lifeswitch/_owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

export async function GET(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const inUrl = new URL(req.url);
  const token = String(inUrl.searchParams.get("token") || "").trim();

  const upstream = new URL(`${BRAINS_URL}/lifeswitch/training/workout_template_shares/preview`);
  upstream.searchParams.set("token", token);

  try {
    const r = await fetch(upstream.toString(), {
      method: "GET",
      headers: lifeSwitchUpstreamHeaders(rid, null),
      cache: "no-store",
    });

    const out = await r.text().catch(() => "");
    return new Response(out, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") || "application/json; charset=utf-8",
        "x-request-id": rid,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "brains_unreachable", detail: String(e) }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8", "x-request-id": rid },
    });
  }
}
