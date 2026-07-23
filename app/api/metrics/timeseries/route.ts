export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getActorUserId } from "../../_lib/actor";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  return raw || crypto.randomUUID();
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const u = new URL(req.url);
  const qs = u.searchParams.toString();
  const url = `${BRAINS_URL}/metrics/timeseries${qs ? `?${qs}` : ""}`;

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
  const headers = brainsUpstreamHeaders(requestId, actor);

  const upstream = await fetch(url, { method: "GET", cache: "no-store", headers });
  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "x-request-id": requestId,
    },
  });
}
