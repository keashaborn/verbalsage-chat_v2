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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ workout_template_id: string }> },
) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const { workout_template_id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const workoutRole = String(body?.workout_role || "")
    .trim()
    .toLowerCase();
  if (workoutRole !== "strength" && workoutRole !== "rehab") {
    return Response.json(
      { error: "workout_role must be strength or rehab" },
      { status: 400, headers: { "x-request-id": rid } },
    );
  }

  const upstream = new URL(
    `${BRAINS_URL}/lifeswitch/training/workout_templates/${encodeURIComponent(workout_template_id)}/classify_historical_sessions`,
  );
  injectOwnerUserId(upstream, owner_user_id);
  upstream.searchParams.set("workout_role", workoutRole);

  try {
    const response = await fetch(upstream.toString(), {
      method: "POST",
      headers: lifeSwitchUpstreamHeaders(req, rid, owner_user_id, {
        "Idempotency-Key": req.headers.get("idempotency-key") || randomUUID(),
      }),
      cache: "no-store",
    });
    const text = await response.text().catch(() => "");
    return new Response(text, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ||
          "application/json; charset=utf-8",
        "x-request-id": rid,
      },
    });
  } catch (error) {
    return Response.json(
      { error: "brains_unreachable", detail: String(error) },
      { status: 502, headers: { "x-request-id": rid } },
    );
  }
}
