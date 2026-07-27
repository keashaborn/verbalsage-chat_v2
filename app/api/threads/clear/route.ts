import { NextResponse } from "next/server";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import {
  getRequestId,
  getThreadUserId,
  unauthorized,
} from "@/app/api/threads/_threadAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const user_id = await getThreadUserId(req);
  if (!user_id) return unauthorized(requestId);

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const upstream = await fetch(
    `${BRAINS}/threads/active/${encodeURIComponent(user_id)}`,
    {
      method: "DELETE",
      headers: brainsUpstreamHeaders(requestId, user_id, {
        Accept: "application/json",
      }),
      cache: "no-store",
    },
  );
  const text = await upstream.text().catch(() => "");

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `brains HTTP ${upstream.status}`, details: text },
      { status: 502, headers: { "x-request-id": requestId } },
    );
  }

  return NextResponse.json(
    { ok: true, thread_id: null },
    { status: 200, headers: { "x-request-id": requestId } },
  );
}
