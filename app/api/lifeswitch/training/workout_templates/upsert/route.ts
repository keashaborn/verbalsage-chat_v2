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

const BRAINS_URL = (
  process.env.BRAINS_URL || "http://172.31.32.171:8088"
).replace(/\/+$/, "");

export async function POST(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();

  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const inUrl = new URL(req.url);
  const upstream = new URL(
    `${BRAINS_URL}/lifeswitch/training/workout_templates/upsert`,
  );
  upstream.search = inUrl.search;
  injectOwnerUserId(upstream, owner_user_id);

  const raw = await req.text().catch(() => "");
  let parsed: any = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }

  for (const key of ["workout_template_id", "name", "notes", "workout_role"]) {
    const value = parsed?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      upstream.searchParams.set(key, String(value));
    }
  }

  const idempotencyKey = req.headers.get("idempotency-key") || randomUUID();

  try {
    const r = await fetch(upstream.toString(), {
      method: "POST",
      headers: lifeSwitchUpstreamHeaders(req, rid, owner_user_id, {
        "Idempotency-Key": idempotencyKey,
      }),
      cache: "no-store",
    });

    const body = await r.text().catch(() => "");
    return new Response(body, {
      status: r.status,
      headers: {
        "content-type":
          r.headers.get("content-type") || "application/json; charset=utf-8",
        "x-request-id": rid,
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "brains_unreachable", detail: String(e) }),
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
