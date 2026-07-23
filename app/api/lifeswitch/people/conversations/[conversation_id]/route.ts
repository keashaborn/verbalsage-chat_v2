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

const BRAINS_URL = (
  process.env.BRAINS_URL || "http://172.31.32.171:8088"
).replace(/\/+$/, "");

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ conversation_id: string }> },
) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const ownerUserId = await getLifeSwitchOwnerUserId(req);
  if (!ownerUserId) return unauthorizedLifeSwitch(rid);

  const { conversation_id } = await ctx.params;
  const upstream = new URL(
    `${BRAINS_URL}/lifeswitch/people/conversations/${encodeURIComponent(conversation_id)}`,
  );
  injectOwnerUserId(upstream, ownerUserId);

  try {
    const response = await fetch(upstream.toString(), {
      method: "DELETE",
      headers: lifeSwitchUpstreamHeaders(rid, ownerUserId),
      cache: "no-store",
    });
    const body = await response.text().catch(() => "");
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ||
          "application/json; charset=utf-8",
        "x-request-id": rid,
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "brains_unreachable",
        detail: String(error),
      }),
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
