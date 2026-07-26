export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import {
  forbiddenThread,
  getRequestId,
  getThreadUserId,
  threadBelongsToUser,
  unauthorized,
  UUID_RE,
} from "@/app/api/threads/_threadAuth";


export async function DELETE(req: NextRequest, context: { params: Promise<{ thread_id: string }> }) {
  const requestId = getRequestId(req);

  const user_id = await getThreadUserId(req);
  if (!user_id) return unauthorized(requestId);

  const { thread_id } = await context.params;
  const tid = String(thread_id || "").trim();
  if (!tid) {
    return NextResponse.json({ error: "missing thread_id" }, { status: 400, headers: { "x-request-id": requestId } });
  }
  if (!UUID_RE.test(tid)) {
    return NextResponse.json({ error: "invalid thread_id" }, { status: 400, headers: { "x-request-id": requestId } });
  }

  const ownsThread = await threadBelongsToUser(tid, user_id, requestId);
  if (!ownsThread) return forbiddenThread(requestId);

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";

  const r = await fetch(`${BRAINS}/threads/${encodeURIComponent(tid)}`, {
    method: "DELETE",
    headers: brainsUpstreamHeaders(requestId, user_id),
    cache: "no-store",
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    return NextResponse.json(
      { error: `brains HTTP ${r.status}`, details: txt },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }

  const response = new NextResponse(txt, {
    status: 200,
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
  });

  if (req.cookies.get("vs_tid")?.value === tid) {
    response.cookies.delete("vs_tid");
  }

  return response;
}
