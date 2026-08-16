import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

const CHAT_HISTORY_CLEAR_PATH = "/chat-history/clear";

export type ChatHistoryClearSelector =
  | { scope: "all" }
  | { scope: "recent"; recentWindowSeconds: number }
  | { scope: "thread"; threadId: string };

type ClearResponse = {
  status?: unknown;
  scope?: unknown;
  deleted_message_count?: unknown;
  deleted_thread_count?: unknown;
  deleted_outbox_count?: unknown;
  memory_retained?: unknown;
  zep_called?: unknown;
  detail?: unknown;
};

export type ChatHistoryClearResult =
  | {
      ok: true;
      deletedMessageCount: number;
      deletedThreadCount: number;
      deletedOutboxCount: number;
    }
  | { ok: false; code: string; status: number };

function failure(status = 503, code = "chat_history_clear_unavailable") {
  return { ok: false, code, status } as const;
}

function boundedCount(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0
    ? Number(value)
    : null;
}

export async function executeChatHistoryClear({
  requestId,
  userId,
  authorization,
  selector,
}: {
  requestId: string;
  userId: string;
  authorization: string;
  selector: ChatHistoryClearSelector;
}): Promise<ChatHistoryClearResult> {
  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const confirmation = {
    all: "CLEAR CHAT HISTORY",
    recent: "CLEAR RECENT CHAT HISTORY",
    thread: "CLEAR CHAT",
  }[selector.scope];
  const body = {
    scope: selector.scope,
    confirmation,
    ...(selector.scope === "recent"
      ? { recent_window_seconds: selector.recentWindowSeconds }
      : {}),
    ...(selector.scope === "thread" ? { thread_id: selector.threadId } : {}),
  };

  let response: Response;
  try {
    response = await fetch(`${BRAINS}${CHAT_HISTORY_CLEAR_PATH}`, {
      method: "POST",
      headers: brainsUpstreamHeaders(requestId, userId, {
        Accept: "application/json",
        Authorization: authorization,
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(16_000),
    });
  } catch {
    return failure();
  }

  const value: unknown = await response.json().catch(() => null);
  const parsed =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as ClearResponse)
      : null;
  if (!response.ok) {
    if (response.status === 401) return failure(401, "unauthorized");
    if (response.status === 403) return failure(403, "forbidden");
    if (response.status === 404) return failure(404, "thread_not_found");
    if (
      response.status === 409 &&
      parsed?.detail === "chat_memory_still_processing"
    ) {
      return failure(409, "chat_memory_still_processing");
    }
    return failure();
  }

  const deletedMessageCount = boundedCount(parsed?.deleted_message_count);
  const deletedThreadCount = boundedCount(parsed?.deleted_thread_count);
  const deletedOutboxCount = boundedCount(parsed?.deleted_outbox_count);
  if (
    parsed?.status !== "completed" ||
    parsed.scope !== selector.scope ||
    parsed.memory_retained !== true ||
    parsed.zep_called !== false ||
    deletedMessageCount === null ||
    deletedThreadCount === null ||
    deletedOutboxCount === null
  ) {
    return failure();
  }
  return {
    ok: true,
    deletedMessageCount,
    deletedThreadCount,
    deletedOutboxCount,
  };
}
