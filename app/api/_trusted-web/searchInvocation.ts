export const AUTOMATIC_SEARCH_INVOCATION_V1 = Symbol(
  "verbalsage.automatic-search-invocation.v1",
);

export type SearchInvocationRouteV1 =
  | "current_news"
  | "trusted_health"
  | "normal_chat";

export function searchCapabilityForInvocationV1(
  invocation: unknown,
): "web_search.use" | "web_search.override" {
  return invocation === AUTOMATIC_SEARCH_INVOCATION_V1
    ? "web_search.use"
    : "web_search.override";
}

export function recordManualSearchOverrideV1({
  actorUserId,
  requestId,
  route,
  invocation,
}: {
  actorUserId: string;
  requestId: string;
  route: SearchInvocationRouteV1;
  invocation: unknown;
}): void {
  if (
    invocation === AUTOMATIC_SEARCH_INVOCATION_V1 ||
    (process.env.SEARCH_DECISION_AUDIT_ENABLED !== "1" &&
      process.env.SEARCH_DECISION_SHADOW_ENABLED !== "1")
  ) {
    return;
  }

  try {
    console.info(
      JSON.stringify({
        event: "search_manual_override_v1",
        request_id: requestId,
        actor_user_id: actorUserId,
        authority: "server",
        selected_route: route,
        capability: "web_search.override",
      }),
    );
  } catch {
    // Search observability must never affect the response path.
  }
}
