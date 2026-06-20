import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getLifeSwitchOwnerUserId, injectOwnerUserId, unauthorizedLifeSwitch } from "@/app/api/lifeswitch/_owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ training_session_id: string; training_set_log_id: string }> }
) {
  const rid = req.headers.get("x-request-id") || randomUUID();

  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const { training_session_id, training_set_log_id } = await ctx.params;
  const upstream = new URL(
    `${BRAINS_URL}/lifeswitch/training/sessions/${encodeURIComponent(training_session_id)}/sets/${encodeURIComponent(
      training_set_log_id
    )}/segments/add`
  );
  injectOwnerUserId(upstream, owner_user_id);

  const raw = await req.text().catch(() => "");
  let parsed: any = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }

  for (const key of ["segment_index", "label", "weight", "reps", "notes"]) {
    const value = parsed?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      upstream.searchParams.set(key, String(value));
    }
  }

  try {
    const r = await fetch(upstream.toString(), {
      method: "POST",
      headers: { "x-request-id": rid },
      cache: "no-store",
    });

    const body = await r.text().catch(() => "");
    return new Response(body, {
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
