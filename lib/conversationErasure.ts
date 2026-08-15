import { createHash } from "node:crypto";

export const CONVERSATION_ERASURE_REQUEST_VERSION =
  "governed-memory-conversation-deletion-request-v1";
export const CONVERSATION_ERASURE_DATA_DOMAIN =
  "chat_source_and_derived_governed_conversational_memory_v1";

const CONFIRMATION_DOMAIN =
  "governed_memory.conversation_deletion_confirmation.v1";

function framedField(name: string, value: string | null): Buffer {
  if (value === null) return Buffer.from(`${name}:-:\n`, "utf8");
  const encoded = Buffer.from(value.normalize("NFC"), "utf8");
  return Buffer.concat([
    Buffer.from(`${name}:${encoded.byteLength}:`, "utf8"),
    encoded,
    Buffer.from("\n", "utf8"),
  ]);
}

type ConversationDeletionConfirmationInput = {
  operationId: string;
  selectorKind: "all_conversations" | "recent" | "thread";
  threadId?: string;
  recentWindowSeconds?: number;
};

function conversationDeletionConfirmationSha256({
  operationId,
  selectorKind,
  threadId,
  recentWindowSeconds,
}: ConversationDeletionConfirmationInput): string {
  const confirmationPhrase = {
    all_conversations: "DELETE CHAT DATA",
    recent: "FORGET RECENT CONVERSATIONS",
    thread: "DELETE CHAT",
  }[selectorKind];
  const hash = createHash("sha256");
  hash.update(Buffer.from(`${CONFIRMATION_DOMAIN}\n`, "utf8"));
  for (const [name, value] of [
    ["operation_id", operationId],
    ["selector_kind", selectorKind],
    ["thread_id", threadId ?? null],
    ["anchor_message_id", null],
    [
      "recent_seconds",
      recentWindowSeconds === undefined ? null : String(recentWindowSeconds),
    ],
    ["confirmation_phrase", confirmationPhrase],
  ] as const) {
    hash.update(framedField(name, value));
  }
  return hash.digest("hex");
}

export function conversationThreadDeletionConfirmationSha256(
  operationId: string,
  threadId: string,
): string {
  return conversationDeletionConfirmationSha256({
    operationId,
    selectorKind: "thread",
    threadId,
  });
}

export function conversationAllDeletionConfirmationSha256(
  operationId: string,
): string {
  return conversationDeletionConfirmationSha256({
    operationId,
    selectorKind: "all_conversations",
  });
}

export function conversationRecentDeletionConfirmationSha256(
  operationId: string,
  recentWindowSeconds: number,
): string {
  if (!Number.isSafeInteger(recentWindowSeconds) || recentWindowSeconds <= 0) {
    throw new TypeError("invalid recent deletion window");
  }
  return conversationDeletionConfirmationSha256({
    operationId,
    selectorKind: "recent",
    recentWindowSeconds,
  });
}
