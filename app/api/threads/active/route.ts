import { NextResponse } from "next/server";
import {
  getRequestId,
  getThreadUserId,
  threadUpstreamHeaders,
  unauthorized,
  UUID_RE,
} from "@/app/api/threads/_threadAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const user_id = await getThreadUserId(req);
  if (!user_id) return unauthorized(requestId);

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const upstream = await fetch(
    `${BRAINS}/threads/active/${encodeURIComponent(user_id)}`,
    {
      headers: threadUpstreamHeaders(req, requestId, user_id, {
        Accept: "application/json",
      }),
      cache: "no-store",
    },
  );
  const text = await upstream.text().catch(() => "");

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `brains HTTP ${upstream.status}`, details: text },
      {
        status: 502,
        headers: {
          "x-request-id": requestId,
          "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        },
      },
    );
  }

  let payload: any = {};
  try {
    payload = JSON.parse(text);
  } catch {}

  const rawThreadId = String(payload?.thread_id || "").trim();
  const thread_id = UUID_RE.test(rawThreadId) ? rawThreadId : null;

  return NextResponse.json(
    { thread_id },
    {
      status: 200,
      headers: {
        "x-request-id": requestId,
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      },
    },
  );
}
