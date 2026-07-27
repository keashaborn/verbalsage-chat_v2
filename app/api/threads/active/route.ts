import { cookies } from "next/headers";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import {
  clearActiveThreadResponse,
  getRequestId,
  getThreadUserId,
  threadBelongsToUser,
  unauthorized,
} from "@/app/api/threads/_threadAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  const user_id = await getThreadUserId(req);
  if (!user_id) return unauthorized(requestId);

  const jar = await cookies();
  const tid = String(jar.get("vs_tid")?.value || "").trim();

  if (tid) {
    const ok = await threadBelongsToUser(tid, user_id, requestId);

    if (ok) {
      return Response.json(
        { thread_id: tid },
        { headers: { "x-request-id": requestId } }
      );
    }
  }

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";

  const r = await fetch(
    `${BRAINS}/threads/list/${encodeURIComponent(user_id)}`,
    {
      headers: brainsUpstreamHeaders(requestId, user_id, {
        Accept: "application/json",
      }),
      cache: "no-store",
    }
  );

  if (!r.ok) {
    return clearActiveThreadResponse({ thread_id: null });
  }

  const threads = await r.json().catch(() => []);

  if (Array.isArray(threads) && threads.length > 0) {
    const newest = threads[0]?.thread_id || threads[0]?.id;

    if (newest) {
      return Response.json(
        { thread_id: newest },
        { headers: { "x-request-id": requestId } }
      );
    }
  }

  return clearActiveThreadResponse({ thread_id: null });
}
