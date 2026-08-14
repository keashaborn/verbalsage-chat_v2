export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import {
  CONVERSATION_ERASURE_DATA_DOMAIN,
  CONVERSATION_ERASURE_REQUEST_VERSION,
  conversationThreadDeletionConfirmationSha256,
} from "@/lib/conversationErasure";
import {
  forbiddenThread,
  getRequestId,
  getThreadUserId,
  threadBelongsToUser,
  unauthorized,
  UUID_RE,
} from "@/app/api/threads/_threadAuth";

const ERASURE_REQUEST_PATH = "/memory/conversations/erasure-requests";
const ERASURE_POLL_INTERVAL_MS = 1_000;
const ERASURE_MAX_POLLS = 45;

type ErasureStatus = {
  operation_id?: unknown;
  selector_kind?: unknown;
  state?: unknown;
};

function noStoreHeaders(requestId: string): Record<string, string> {
  return {
    "cache-control": "private, no-store, max-age=0, must-revalidate",
    "x-request-id": requestId,
  };
}

async function readErasureStatus(
  response: Response,
): Promise<ErasureStatus | null> {
  const value: unknown = await response.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ErasureStatus;
}

function isBoundThreadStatus(
  status: ErasureStatus | null,
  operationId: string,
): status is ErasureStatus {
  return (
    status?.operation_id === operationId &&
    status?.selector_kind === "thread" &&
    typeof status.state === "string"
  );
}

function completedResponse(requestId: string, operationId: string) {
  return NextResponse.json(
    { status: "ok", operation_id: operationId, state: "completed" },
    { status: 200, headers: noStoreHeaders(requestId) },
  );
}

function deletionFailure(
  requestId: string,
  status = 503,
  code = "chat_deletion_unavailable",
) {
  return NextResponse.json(
    { error: code },
    { status, headers: noStoreHeaders(requestId) },
  );
}

async function fetchErasure(
  url: string,
  init: RequestInit,
): Promise<Response | null> {
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(16_000),
    });
  } catch {
    return null;
  }
}

async function waitForNextPoll(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ERASURE_POLL_INTERVAL_MS));
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ thread_id: string }> },
) {
  const requestId = getRequestId(req);

  const user_id = await getThreadUserId(req);
  if (!user_id) return unauthorized(requestId);

  const { thread_id } = await context.params;
  const tid = String(thread_id || "").trim();
  if (!tid) {
    return NextResponse.json(
      { error: "missing thread_id" },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }
  if (!UUID_RE.test(tid)) {
    return NextResponse.json(
      { error: "invalid thread_id" },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  const ownsThread = await threadBelongsToUser(tid, user_id, requestId);
  if (!ownsThread) return forbiddenThread(requestId);

  const authorization = (req.headers.get("authorization") || "").trim();
  if (!authorization) return unauthorized(requestId);

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const threadId = tid.toLowerCase();
  // The thread UUID is also the idempotency key. A browser retry therefore
  // replays the same bounded operation instead of creating a conflicting one.
  const operationId = threadId;
  const upstreamHeaders = brainsUpstreamHeaders(requestId, user_id, {
    Accept: "application/json",
    Authorization: authorization,
  });

  let response = await fetchErasure(`${BRAINS}${ERASURE_REQUEST_PATH}`, {
    method: "POST",
    headers: upstreamHeaders,
    body: JSON.stringify({
      confirmation_sha256: conversationThreadDeletionConfirmationSha256(
        operationId,
        threadId,
      ),
      contract_version: CONVERSATION_ERASURE_REQUEST_VERSION,
      data_domain: CONVERSATION_ERASURE_DATA_DOMAIN,
      operation_id: operationId,
      selector_kind: "thread",
      thread_id: threadId,
    }),
  });

  if (!response) return deletionFailure(requestId);

  let status = await readErasureStatus(response);
  if (
    response.status === 200 &&
    isBoundThreadStatus(status, operationId) &&
    status.state === "completed"
  ) {
    return completedResponse(requestId, operationId);
  }
  if (response.status === 401) return unauthorized(requestId);
  if (response.status === 403) {
    return deletionFailure(requestId, 403, "forbidden");
  }
  if (response.status === 409) {
    return deletionFailure(requestId, 409, "chat_deletion_requires_review");
  }
  if (response.status !== 202 || !isBoundThreadStatus(status, operationId)) {
    return deletionFailure(requestId);
  }

  const statusUrl = `${BRAINS}${ERASURE_REQUEST_PATH}/${encodeURIComponent(operationId)}`;
  for (let attempt = 0; attempt < ERASURE_MAX_POLLS; attempt += 1) {
    await waitForNextPoll();
    response = await fetchErasure(statusUrl, {
      method: "GET",
      headers: upstreamHeaders,
    });
    if (!response) return deletionFailure(requestId);

    status = await readErasureStatus(response);
    if (!isBoundThreadStatus(status, operationId)) {
      if (response.status === 401) return unauthorized(requestId);
      if (response.status === 403) {
        return deletionFailure(requestId, 403, "forbidden");
      }
      return deletionFailure(requestId);
    }
    if (response.status === 200 && status.state === "completed") {
      return completedResponse(requestId, operationId);
    }
    if (response.status === 409 || status.state === "manual_review") {
      return deletionFailure(requestId, 409, "chat_deletion_requires_review");
    }
    if (response.status !== 202) return deletionFailure(requestId);
  }

  return deletionFailure(requestId, 503, "chat_deletion_still_processing");
}
