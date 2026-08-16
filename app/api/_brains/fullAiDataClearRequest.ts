import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

const FULL_AI_DATA_CLEAR_PATH = "/memory/chat-and-zep/clear";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

type FullAiDataClearResponse = {
  contract_version?: unknown;
  status?: unknown;
  operation_id?: unknown;
  deleted_message_count?: unknown;
  deleted_thread_count?: unknown;
  deleted_outbox_count?: unknown;
  chat_receipt_sha256?: unknown;
  memory_retained?: unknown;
  zep_called?: unknown;
  zep_deleted?: unknown;
};

export type FullAiDataClearResult =
  | {
      ok: true;
      operationId: string;
      deletedMessageCount: number;
      deletedThreadCount: number;
      deletedOutboxCount: number;
    }
  | { ok: false; code: string; status: number };

function failure(status = 503, code = "ai_data_deletion_unavailable") {
  return { ok: false, code, status } as const;
}

function boundedCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export async function executeFullAiDataClear({
  requestId,
  userId,
  authorization,
}: {
  requestId: string;
  userId: string;
  authorization: string;
}): Promise<FullAiDataClearResult> {
  const brains = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  let response: Response;
  try {
    response = await fetch(`${brains}${FULL_AI_DATA_CLEAR_PATH}`, {
      method: "DELETE",
      headers: brainsUpstreamHeaders(requestId, userId, {
        Accept: "application/json",
        Authorization: authorization,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return failure();
  }

  if (!response.ok) {
    if (response.status === 401) return failure(401, "unauthorized");
    if (response.status === 403) return failure(403, "forbidden");
    if (response.status === 409) {
      return failure(409, "ai_data_deletion_requires_retry");
    }
    return failure();
  }

  const raw = await response.text().catch(() => "");
  if (!raw || raw.length > 65_536) return failure();
  let parsed: FullAiDataClearResponse;
  try {
    parsed = JSON.parse(raw) as FullAiDataClearResponse;
  } catch {
    return failure();
  }
  if (
    parsed.contract_version !== "chat_and_zep_full_clear_v1" ||
    parsed.status !== "completed" ||
    typeof parsed.operation_id !== "string" ||
    !UUID_RE.test(parsed.operation_id) ||
    !boundedCount(parsed.deleted_message_count) ||
    !boundedCount(parsed.deleted_thread_count) ||
    !boundedCount(parsed.deleted_outbox_count) ||
    typeof parsed.chat_receipt_sha256 !== "string" ||
    !SHA256_RE.test(parsed.chat_receipt_sha256) ||
    parsed.memory_retained !== false ||
    parsed.zep_called !== true ||
    parsed.zep_deleted !== true
  ) {
    return failure();
  }

  return {
    ok: true,
    operationId: parsed.operation_id,
    deletedMessageCount: parsed.deleted_message_count,
    deletedThreadCount: parsed.deleted_thread_count,
    deletedOutboxCount: parsed.deleted_outbox_count,
  };
}

export { FULL_AI_DATA_CLEAR_PATH };
