import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import {
  CONVERSATION_ERASURE_DATA_DOMAIN,
  CONVERSATION_ERASURE_REQUEST_VERSION,
  conversationAllDeletionConfirmationSha256,
  conversationRecentDeletionConfirmationSha256,
} from "@/lib/conversationErasure";

const ERASURE_REQUEST_PATH = "/memory/conversations/erasure-requests";
const ERASURE_POLL_INTERVAL_MS = 1_000;
const ERASURE_MAX_POLLS = 45;

type AdminErasureSelector =
  | { selectorKind: "all_conversations" }
  | { selectorKind: "recent"; recentWindowSeconds: number };

type ErasureStatus = {
  operation_id?: unknown;
  selector_kind?: unknown;
  state?: unknown;
  target_count?: unknown;
};

export type AdminErasureResult =
  | {
      ok: true;
      operationId: string;
      targetCount: number | null;
    }
  | {
      ok: false;
      code: string;
      status: number;
    };

function failure(status = 503, code = "chat_deletion_unavailable") {
  return { ok: false, code, status } as const;
}

async function readErasureStatus(
  response: Response,
): Promise<ErasureStatus | null> {
  const value: unknown = await response.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ErasureStatus;
}

function isBoundStatus(
  status: ErasureStatus | null,
  operationId: string,
  selectorKind: AdminErasureSelector["selectorKind"],
): status is ErasureStatus {
  return (
    status?.operation_id === operationId &&
    status?.selector_kind === selectorKind &&
    typeof status.state === "string"
  );
}

function targetCount(status: ErasureStatus): number | null {
  return Number.isSafeInteger(status.target_count)
    ? (status.target_count as number)
    : null;
}

function completed(
  operationId: string,
  status: ErasureStatus,
): AdminErasureResult {
  return {
    ok: true,
    operationId,
    targetCount: targetCount(status),
  };
}

function responseFailure(response: Response): AdminErasureResult {
  if (response.status === 401) return failure(401, "unauthorized");
  if (response.status === 403) return failure(403, "forbidden");
  if (response.status === 409) {
    return failure(409, "chat_deletion_requires_review");
  }
  return failure();
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

export async function executeAdminConversationErasure({
  requestId,
  userId,
  authorization,
  operationId,
  selector,
}: {
  requestId: string;
  userId: string;
  authorization: string;
  operationId: string;
  selector: AdminErasureSelector;
}): Promise<AdminErasureResult> {
  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const confirmationSha256 =
    selector.selectorKind === "all_conversations"
      ? conversationAllDeletionConfirmationSha256(operationId)
      : conversationRecentDeletionConfirmationSha256(
          operationId,
          selector.recentWindowSeconds,
        );
  const body = {
    confirmation_sha256: confirmationSha256,
    contract_version: CONVERSATION_ERASURE_REQUEST_VERSION,
    data_domain: CONVERSATION_ERASURE_DATA_DOMAIN,
    operation_id: operationId,
    selector_kind: selector.selectorKind,
    ...(selector.selectorKind === "recent"
      ? { recent_window_seconds: selector.recentWindowSeconds }
      : {}),
  };
  const upstreamHeaders = brainsUpstreamHeaders(requestId, userId, {
    Accept: "application/json",
    Authorization: authorization,
    "Content-Type": "application/json",
  });

  let response = await fetchErasure(`${BRAINS}${ERASURE_REQUEST_PATH}`, {
    method: "POST",
    headers: upstreamHeaders,
    body: JSON.stringify(body),
  });
  if (!response) return failure();

  let status = await readErasureStatus(response);
  if (
    response.status === 200 &&
    isBoundStatus(status, operationId, selector.selectorKind) &&
    status.state === "completed"
  ) {
    return completed(operationId, status);
  }
  if (
    response.status !== 202 ||
    !isBoundStatus(status, operationId, selector.selectorKind)
  ) {
    return responseFailure(response);
  }

  const statusUrl = `${BRAINS}${ERASURE_REQUEST_PATH}/${encodeURIComponent(operationId)}`;
  for (let attempt = 0; attempt < ERASURE_MAX_POLLS; attempt += 1) {
    await waitForNextPoll();
    response = await fetchErasure(statusUrl, {
      method: "GET",
      headers: upstreamHeaders,
    });
    if (!response) return failure();

    status = await readErasureStatus(response);
    if (!isBoundStatus(status, operationId, selector.selectorKind)) {
      return responseFailure(response);
    }
    if (response.status === 200 && status.state === "completed") {
      return completed(operationId, status);
    }
    if (response.status === 409 || status.state === "manual_review") {
      return failure(409, "chat_deletion_requires_review");
    }
    if (response.status !== 202) return responseFailure(response);
  }

  return failure(503, "chat_deletion_still_processing");
}
