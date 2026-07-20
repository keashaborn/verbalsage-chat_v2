import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getLifeSwitchOwnerUserId, injectOwnerUserId, unauthorizedLifeSwitch, lifeSwitchUpstreamHeaders } from "@/app/api/lifeswitch/_owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");

export async function GET(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);
  const inUrl = new URL(req.url);

  const upstream = new URL(`${BRAINS_URL}/lifeswitch/nutrition/log/day`);
  upstream.search = inUrl.search;
  injectOwnerUserId(upstream, owner_user_id);

  let r: Response;
  try {
    r = await fetch(upstream.toString(), {
      headers: lifeSwitchUpstreamHeaders(rid, owner_user_id),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json(
      { detail: timedOut ? "Nutrition request timed out" : "Nutrition service unavailable" },
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

export async function PATCH(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();
  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  let incoming: unknown;
  try {
    incoming = await req.json();
  } catch {
    return Response.json(
      { detail: "JSON body required" },
      { status: 400, headers: { "x-request-id": rid } },
    );
  }
  if (
    !incoming ||
    typeof incoming !== "object" ||
    typeof (incoming as { completed?: unknown }).completed !== "boolean"
  ) {
    return Response.json(
      { detail: "completed must be boolean" },
      { status: 400, headers: { "x-request-id": rid } },
    );
  }

  const inUrl = new URL(req.url);
  const day = String(inUrl.searchParams.get("day") || "").trim();
  const upstream = new URL(`${BRAINS_URL}/lifeswitch/nutrition/log/day`);
  upstream.searchParams.set("day", day);
  injectOwnerUserId(upstream, owner_user_id);

  let r: Response;
  try {
    r = await fetch(upstream.toString(), {
      method: "PATCH",
      headers: {
        ...lifeSwitchUpstreamHeaders(rid, owner_user_id),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        completed: (incoming as { completed: boolean }).completed,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json(
      { detail: timedOut ? "Nutrition request timed out" : "Nutrition service unavailable" },
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
