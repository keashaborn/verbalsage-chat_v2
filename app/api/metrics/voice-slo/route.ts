export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import { getActorUserId } from "@/app/api/_lib/actor";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function getRequestId(req: Request): string {
  const raw = (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    ""
  ).trim();
  return raw || crypto.randomUUID();
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const actor = await getActorUserId(req);
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      {
        status: 401,
        headers: { ...NO_STORE_HEADERS, "x-request-id": requestId },
      },
    );
  }

  const requestedWindow = Number(
    new URL(req.url).searchParams.get("window_days") || 30,
  );
  const windowDays = Number.isInteger(requestedWindow)
    ? Math.max(1, Math.min(30, requestedWindow))
    : 30;
  const brainsUrl = (
    process.env.BRAINS_URL || "http://172.31.32.171:8088"
  ).replace(/\/+$/, "");
  const upstream = await fetch(
    `${brainsUrl}/metrics/voice-slo?window_days=${windowDays}`,
    {
      method: "GET",
      cache: "no-store",
      headers: brainsUpstreamHeaders(requestId, actor),
    },
  );
  const body = await upstream.text();

  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type":
        upstream.headers.get("content-type") || "application/json",
      "x-request-id": requestId,
    },
  });
}
