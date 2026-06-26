import {
  forbiddenThread,
  getRequestId,
  getThreadUserId,
  setActiveThreadResponse,
  threadBelongsToUser,
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
    return Response.json(
      {
        error: "invalid_thread_id",
        received_thread_id: thread_id,
        received_keys: body && typeof body === "object" ? Object.keys(body) : [],
      },
      { status: 400, headers: { "x-request-id": requestId } }
    );
  }

  const ok = await threadBelongsToUser(thread_id, user_id, requestId);
  if (!ok) return forbiddenThread(requestId);

  return await setActiveThreadResponse(thread_id);
}
