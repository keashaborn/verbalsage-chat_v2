import { cookies } from "next/headers";
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

  if (!tid) return clearActiveThreadResponse({ thread_id: null });

  const ok = await threadBelongsToUser(tid, user_id, requestId);
  if (!ok) return clearActiveThreadResponse({ thread_id: null });

  return Response.json({ thread_id: tid }, { headers: { "x-request-id": requestId } });
}
