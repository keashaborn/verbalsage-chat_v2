import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import {
  getLifeSwitchOwnerUserId,
  injectOwnerUserId,
  lifeSwitchUpstreamHeaders,
  unauthorizedLifeSwitch,
} from "@/app/api/lifeswitch/_owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ relationship_id: string }> }
) {
  const rid = req.headers.get("x-request-id") || randomUUID();

  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const { relationship_id } = await ctx.params;
  const upstream = new URL(
    `${BRAINS_URL}/lifeswitch/people/relationships/${encodeURIComponent(relationship_id)}/revoke`
  );
  injectOwnerUserId(upstream, owner_user_id);

  try {
    const r = await fetch(upstream.toString(), {
      method: "POST",
      headers: lifeSwitchUpstreamHeaders(rid, owner_user_id),
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
