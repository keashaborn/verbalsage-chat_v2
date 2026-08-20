import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getLifeSwitchOwnerUserId, unauthorizedLifeSwitch, lifeSwitchUpstreamHeaders } from "@/app/api/lifeswitch/_owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

export async function POST(req: NextRequest, ctx: { params: Promise<{ workout_template_id: string }> }) {
  const rid = req.headers.get("x-request-id") || randomUUID();

  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const { workout_template_id } = await ctx.params;

  const upstream = new URL(
    `${BRAINS_URL}/lifeswitch/training/workout_templates/${encodeURIComponent(workout_template_id)}/exercises/upsert`
  );

  const raw = await req.text().catch(() => "");
  let parsed: any = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }

  for (const key of ["exercise_id", "display_name_snapshot", "sort_order", "set_type", "planned_sets", "default_weight", "default_reps", "flags"]) {
    const value = parsed?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      upstream.searchParams.set(key, String(value));
    }
  }

  try {
    const r = await fetch(upstream.toString(), {
      method: "POST",
      headers: lifeSwitchUpstreamHeaders(req, rid, owner_user_id),
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
