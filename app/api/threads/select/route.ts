import { NextResponse } from "next/server";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import {
  forbiddenThread,
  getRequestId,
  getThreadUserId,
  unauthorized,
  UUID_RE,
} from "@/app/api/threads/_threadAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const user_id = await getThreadUserId(req);
  if (!user_id) return unauthorized(requestId);

  const body = await req.json().catch(() => ({}));
  const thread_id = String(body?.thread_id || "").trim();
  if (!UUID_RE.test(thread_id)) {
    return NextResponse.json(
      { error: "invalid_thread_id" },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const upstream = await fetch(`${BRAINS}/threads/active`, {
    method: "POST",
    headers: brainsUpstreamHeaders(requestId, user_id, {
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify({ user_id, thread_id }),
    cache: "no-store",
  });
  const text = await upstream.text().catch(() => "");

  if (upstream.status === 404) return forbiddenThread(requestId);
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `brains HTTP ${upstream.status}`, details: text },
      { status: 502, headers: { "x-request-id": requestId } },
    );
  }

  let payload: any = {};
  try {
    payload = JSON.parse(text);
  } catch {}

  if (String(payload?.thread_id || "").trim() !== thread_id) {
    return NextResponse.json(
      { error: "active_thread_contract_mismatch" },
      { status: 502, headers: { "x-request-id": requestId } },
    );
  }

  return NextResponse.json(
    { ok: true, thread_id },
    { status: 200, headers: { "x-request-id": requestId } },
  );
}
