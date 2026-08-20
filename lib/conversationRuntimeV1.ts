export const CONVERSATION_RESPONSE_RUNTIME_V1 = "conversation_response_v1";
export const LIFESWITCH_RESPONSE_RUNTIME_V1 = "lifeswitch_response_v1";

export const LEGACY_CONVERSATION_RESPONSE_RUNTIME_V0_2 =
  "resse_response_v0_2";
export const LEGACY_LIFESWITCH_RESPONSE_RUNTIME_V0_3 =
  "resse_response_v0_3";
export const LEGACY_LIFESWITCH_RESPONSE_RUNTIME_V0_4 =
  "resse_response_v0_4";

export const BACKEND_CONVERSATION_RUNTIMES = [
  CONVERSATION_RESPONSE_RUNTIME_V1,
  LIFESWITCH_RESPONSE_RUNTIME_V1,
  LEGACY_CONVERSATION_RESPONSE_RUNTIME_V0_2,
  LEGACY_LIFESWITCH_RESPONSE_RUNTIME_V0_3,
  LEGACY_LIFESWITCH_RESPONSE_RUNTIME_V0_4,
] as const;

export type BackendConversationRuntimeV1 =
  (typeof BACKEND_CONVERSATION_RUNTIMES)[number];

const BACKEND_CONVERSATION_RUNTIME_SET = new Set<string>(
  BACKEND_CONVERSATION_RUNTIMES,
);

export function backendConversationRuntimeFromValue(
  value: unknown,
): BackendConversationRuntimeV1 | null {
  return typeof value === "string" &&
    BACKEND_CONVERSATION_RUNTIME_SET.has(value)
    ? (value as BackendConversationRuntimeV1)
    : null;
}

export type ResponseTraceRuntimeV1 =
  | BackendConversationRuntimeV1
  | "trusted_web_v1"
  | "current_news_v1";

export function responseTraceRuntimeFromValue(
  value: unknown,
): ResponseTraceRuntimeV1 | null {
  return value === "trusted_web_v1" || value === "current_news_v1"
    ? value
    : backendConversationRuntimeFromValue(value);
}
