export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { executeChatHistoryClear } from "@/app/api/_brains/chatHistoryClearRequest";
import {
  forbiddenThread,
  getRequestId,
  getThreadUserId,
  threadBelongsToUser,
  unauthorized,
  UUID_RE,
} from "@/app/api/threads/_threadAuth";

function noStoreHeaders(requestId: string): Record<string, string> {
  return {
    "cache-control": "private, no-store, max-age=0, must-revalidate",
    "x-request-id": requestId,
  };
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ thread_id: string; message_id: string }> },
) {
  const requestId = getRequestId(req);
  const userId = await getThreadUserId(req);
  if (!userId) return unauthorized(requestId);

  const { thread_id, message_id } = await context.params;
  const threadId = String(thread_id || "")
    .trim()
    .toLowerCase();
  const messageId = String(message_id || "")
    .trim()
    .toLowerCase();
  if (!UUID_RE.test(threadId)) {
    return NextResponse.json(
      { error: "invalid thread_id" },
      { status: 400, headers: noStoreHeaders(requestId) },
    );
  }
  if (!UUID_RE.test(messageId)) {
    return NextResponse.json(
      { error: "invalid message_id" },
      { status: 400, headers: noStoreHeaders(requestId) },
    );
  }

  const ownsThread = await threadBelongsToUser(threadId, userId, requestId);
  if (!ownsThread) return forbiddenThread(requestId);

  const authorization = (req.headers.get("authorization") || "").trim();
  if (!authorization) return unauthorized(requestId);

  const result = await executeChatHistoryClear({
    requestId,
    userId,
    authorization,
    selector: {
      scope: "message_tail",
      threadId,
      anchorMessageId: messageId,
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code },
      { status: result.status, headers: noStoreHeaders(requestId) },
    );
  }

  return NextResponse.json(
    {
      status: "ok",
      state: "completed",
      target_count: result.deletedMessageCount,
      deleted_message_count: result.deletedMessageCount,
      deleted_thread_count: result.deletedThreadCount,
      memory_retained: true,
    },
    { status: 200, headers: noStoreHeaders(requestId) },
  );
}
