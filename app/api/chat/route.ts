export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import {
  BRAINS_RESPONSE_TIMEOUT_MS,
  isAbortLike,
  requestDeadlineSignal,
} from "@/lib/requestDeadline";
import {
  getFreshSupabaseAuthContextFromRequest,
  getSupabaseBearerAuthorizationFromRequest,
} from "@/app/api/_auth/supabaseUser";
import {
  capabilityAllowsRole,
  normalizePermissionRole,
} from "@/app/api/_auth/requireCapability";
import {
  responseTraceAccessAllowedV2,
  responseTraceHeadersV2,
} from "@/app/api/_inspection/responseTraceV2";
import {
  automaticSearchRouteUsesExternalWebV1,
  recordSearchRoutingEnforcedV1,
  SEARCH_DECISION_POLICY_VERSION,
  type AutomaticSearchRouteV1,
  type SearchDecisionV1,
} from "@/lib/searchDecisionV1";
import { recordManualSearchOverrideV1 } from "@/app/api/_trusted-web/searchInvocation";
import {
  resolveServerSearchControlV1,
  SERVER_SEARCH_AUTHORITY_VERSION,
  type ServerSearchModeV1,
} from "@/lib/serverSearchAuthorityV1";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import {
  voiceTurnHeaders,
  voiceTurnIdFromRequest,
} from "@/lib/voiceObservability";
import {
  voiceSessionHeaders,
  voiceSessionIdFromRequest,
} from "@/lib/voiceSession";
import {
  responseInspectionV1FromValue,
  type ResponseInspectionV1,
  type ResponseTraceTimingV2,
  type ResponseTraceV2,
} from "@/lib/responseTraceV2";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESPONSE_TIMING_KEYS = [
  "command_validation_ms",
  "conversation_snapshot_ms",
  "policy_input_ms",
  "signal_classification_ms",
  "signal_binding_ms",
  "memory_selection_ms",
  "trusted_request_ms",
  "orchestration_ms",
  "answer_generation_ms",
  "finalization_ms",
  "pipeline_total_ms",
  "persistence_ms",
  "backend_total_ms",
] as const;
function requestId(req: Request): string {
  const raw = (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    ""
  ).trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

function lastUserText(messages: any[]): string {
  const item = [...messages]
    .reverse()
    .find((message) => message?.role === "user");
  if (!item) return "";
  if (typeof item.content === "string") return item.content;
  const parts = Array.isArray(item.parts)
    ? item.parts
    : Array.isArray(item.content)
      ? item.content
      : [];
  return parts.map((part: any) => String(part?.text || "")).join("");
}

function shouldAvoidStorage(body: any, message: string): boolean {
  const normalized = message.trim().toLowerCase();
  const testPrefixes = [
    "say exactly:",
    "return exactly:",
    "reply with only",
    "reply with exactly",
    "echo decision",
    "echo model",
    "echo threadctx",
    "memtest:",
    "memoryseed:",
    "seedmemory:",
    "preflight_",
    "preflight:",
  ];
  return (
    body?.noStore === true ||
    body?.debug === true ||
    testPrefixes.some((prefix) => normalized.startsWith(prefix))
  );
}

function normalizedResponseTimings(
  value: unknown,
): ResponseTraceTimingV2 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const timings: ResponseTraceTimingV2 = {};
  for (const key of RESPONSE_TIMING_KEYS) {
    const number = Number(source[key]);
    if (!Number.isFinite(number) || number < 0 || number > 600_000) continue;
    timings[key] = Math.round(number);
  }
  return "backend_total_ms" in timings ? timings : null;
}

function responseTimingsHeader(timings: ResponseTraceTimingV2 | null): string {
  return timings
    ? Buffer.from(JSON.stringify(timings), "utf8").toString("base64url")
    : "";
}

function boundedHeaderInteger(value: string | null, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= maximum
    ? parsed
    : 0;
}

function serverSearchExecutionRequest(
  req: Request,
  rid: string,
  brains: string,
  userId: string,
  threadId: string | null,
  query: string,
  noStore: boolean,
  voice: boolean,
): Request | null {
  const authorization = getSupabaseBearerAuthorizationFromRequest(req);
  if (!authorization) return null;
  return new Request(`${brains}/search/execute`, {
    method: "POST",
    headers: {
      ...brainsUpstreamHeaders(rid, userId),
      authorization,
      "content-type": "application/json",
      "x-vs-web-search-authorization": "supabase_fresh_web_search_v1",
    },
    body: JSON.stringify({
      user_id: userId,
      thread_id: threadId,
      query,
      channel: voice ? "voice" : "text",
      persist_transcript: !noStore,
    }),
    cache: "no-store",
    signal: req.signal,
  });
}

function automaticSearchTraceV2({
  response,
  route,
  decision,
  rid,
}: {
  response: Response;
  route: Exclude<AutomaticSearchRouteV1, "normal_chat">;
  decision: SearchDecisionV1;
  rid: string;
}): ResponseTraceV2 {
  const webSearched = response.headers.get("X-VS-Web-Searched") === "1";
  const responseRuntime =
    route === "current_news" ? "current_news_v1" : "trusted_web_v1";
  return {
    contract_version: "response_trace_v2",
    authorities: {
      identity: "supabase",
      routing: "verbalsage_server_authority_v1",
      response_runtime: responseRuntime,
    },
    request: {
      request_id: rid,
      channel:
        response.headers.get("X-VS-Request-Channel") === "voice"
          ? "voice"
          : "text",
      transcript_persistence:
        response.headers.get("X-VS-Transcript-Persistence") === "persisted"
          ? "persisted"
          : "skipped",
    },
    authorization: {
      actor_verification: "supabase_fresh_user_lookup",
      execution_authorization: "web_search.use",
      inspection_capability: "inspector.view",
      inspection_verification: "supabase_fresh_user_lookup",
    },
    routing: {
      search_mode: "auto",
      policy_version: decision.policy_version,
      decision: decision.decision,
      reason_codes: [...decision.reason_codes],
      policy_pack: decision.policy_pack,
      selected_route: route,
      attempted_route: route,
      executed_external_web_access: webSearched,
      fallback_to_chat: false,
      budget: { ...decision.budget },
    },
    execution: {
      web_searched: webSearched,
      source_count: boundedHeaderInteger(
        response.headers.get("X-VS-Web-Source-Count"),
        50,
      ),
      cited_source_count: boundedHeaderInteger(
        response.headers.get("X-VS-Web-Cited-Source-Count"),
        50,
      ),
      admitted_source_count: boundedHeaderInteger(
        response.headers.get("X-VS-Web-Admitted-Source-Count"),
        50,
      ),
      provider_consulted_source_count: boundedHeaderInteger(
        response.headers.get("X-VS-Web-Provider-Consulted-Source-Count"),
        50,
      ),
      consulted_source_count: boundedHeaderInteger(
        response.headers.get("X-VS-Web-Consulted-Source-Count"),
        50,
      ),
      rejected_source_count: boundedHeaderInteger(
        response.headers.get("X-VS-Web-Rejected-Source-Count"),
        50,
      ),
      validation: response.ok ? "passed" : "failed",
    },
    timings: null,
    response_inspection: null,
  };
}

function routedSearchResponse(
  response: Response,
  route: Exclude<AutomaticSearchRouteV1, "normal_chat">,
  decision: SearchDecisionV1,
  rid: string,
  includeInspection: boolean,
): Response {
  const headers = new Headers(response.headers);
  headers.set("X-VS-Search-Authority", SERVER_SEARCH_AUTHORITY_VERSION);
  headers.set("X-VS-Search-Decision", decision.decision);
  headers.set("X-VS-Search-Policy", decision.policy_pack);
  headers.set("X-VS-Search-Route", route);
  if (includeInspection) {
    const traceHeaders = responseTraceHeadersV2(
      automaticSearchTraceV2({ response, route, decision, rid }),
    );
    for (const [key, value] of Object.entries(traceHeaders)) {
      headers.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

type AutomaticSearchResult = Readonly<{
  response: Response | null;
  attemptedRoute: Exclude<AutomaticSearchRouteV1, "normal_chat"> | null;
  fallbackToChat: boolean;
  decision: SearchDecisionV1 | null;
  terminalResponse: Response | null;
}>;

function searchDecisionFromPlan(value: any): SearchDecisionV1 | null {
  if (!value || typeof value !== "object") return null;
  const decision = String(value.decision || "");
  const policyVersion = String(value.policy_version || "");
  const policyPack = String(value.policy_pack || "");
  const reasonCodes = Array.isArray(value.reason_codes)
    ? value.reason_codes.map((item: unknown) => String(item))
    : null;
  const budget = value.budget;
  if (
    !["no_search", "indexed", "live", "research"].includes(decision) ||
    policyVersion !== SEARCH_DECISION_POLICY_VERSION ||
    !reasonCodes ||
    !budget ||
    !Number.isInteger(budget.max_searches) ||
    !Number.isInteger(budget.max_sources)
  ) {
    return null;
  }
  return {
    policy_version: SEARCH_DECISION_POLICY_VERSION,
    decision: decision as SearchDecisionV1["decision"],
    reason_codes: reasonCodes as SearchDecisionV1["reason_codes"],
    policy_pack: policyPack as SearchDecisionV1["policy_pack"],
    query_context: "current_message_only",
    external_web_access: Boolean(value.external_web_access),
    confidence: value.confidence === "high" ? "high" : "medium",
    budget: {
      max_searches: budget.max_searches,
      max_sources: budget.max_sources,
    },
  };
}

async function runServerSearchPlan(
  req: Request,
  rid: string,
  brains: string,
  userId: string,
  threadId: string | null,
  message: string,
  noStore: boolean,
  voice: boolean,
): Promise<AutomaticSearchResult> {
  const delegated = serverSearchExecutionRequest(
    req,
    rid,
    brains,
    userId,
    threadId,
    message,
    noStore,
    voice,
  );
  if (!delegated) {
    return {
      response: null,
      attemptedRoute: null,
      fallbackToChat: false,
      decision: null,
      terminalResponse: null,
    };
  }
  const upstream = await fetch(delegated);
  const raw = await upstream.text().catch(() => "");
  if (!upstream.ok) {
    return {
      response: null,
      attemptedRoute: null,
      fallbackToChat: false,
      decision: null,
      terminalResponse: new Response(raw || "Search execution unavailable", {
        status: upstream.status,
        headers: upstream.headers,
      }),
    };
  }
  let payload: any = null;
  try {
    payload = JSON.parse(raw);
  } catch {}
  const decision = searchDecisionFromPlan(payload?.plan);
  const selectedRoute = String(payload?.plan?.selected_route || "");
  if (
    !decision ||
    !["normal_chat", "trusted_health", "current_news"].includes(selectedRoute)
  ) {
    return {
      response: null,
      attemptedRoute: null,
      fallbackToChat: false,
      decision: null,
      terminalResponse: new Response("Invalid server search plan", {
        status: 502,
      }),
    };
  }
  const route = selectedRoute as AutomaticSearchRouteV1;
  recordSearchRoutingEnforcedV1({
    actorUserId: userId,
    requestId: rid,
    selectedRoute: route,
    input: message,
    decision,
  });
  if (payload?.executed !== true || route === "normal_chat") {
    return {
      response: null,
      attemptedRoute: route === "normal_chat" ? null : route,
      fallbackToChat: payload?.fallback_to_chat === true,
      decision,
      terminalResponse: null,
    };
  }
  const headers = new Headers(upstream.headers);
  headers.set("X-VS-Request-Channel", voice ? "voice" : "text");
  headers.set(
    "X-VS-Transcript-Persistence",
    payload?.transcript_persistence === "persisted_memory_ineligible"
      ? "persisted"
      : "skipped",
  );
  if (UUID_RE.test(String(payload?.answer_id || ""))) {
    headers.set("X-VS-Answer-Id", String(payload.answer_id));
  }
  return {
    response: new Response(
      JSON.stringify({
        answer: payload?.answer,
        sources: payload?.sources || [],
        cited_sources: payload?.cited_sources || payload?.sources || [],
        admitted_sources: payload?.admitted_sources || payload?.sources || [],
        consulted_sources: payload?.consulted_sources || [],
      }),
      {
        status: 200,
        headers,
      },
    ),
    attemptedRoute: route,
    fallbackToChat: false,
    decision,
    terminalResponse: null,
  };
}

function ordinaryResponseTraceV2({
  rid,
  searchMode,
  manualOverride,
  automaticDecision,
  attemptedRoute,
  fallbackToChat,
  noStore,
  voice,
  timings,
  responseInspection,
}: {
  rid: string;
  searchMode: ServerSearchModeV1;
  manualOverride: boolean;
  automaticDecision: SearchDecisionV1 | null;
  attemptedRoute: Exclude<AutomaticSearchRouteV1, "normal_chat"> | null;
  fallbackToChat: boolean;
  noStore: boolean;
  voice: boolean;
  timings: ResponseTraceTimingV2 | null;
  responseInspection: ResponseInspectionV1 | null;
}): ResponseTraceV2 {
  const reasonCodes = automaticDecision
    ? [...automaticDecision.reason_codes]
    : manualOverride
      ? ["manual_override_authorized"]
      : [
          voice
            ? "voice_search_disabled"
            : noStore
              ? "stateless_response_search_evaluated"
              : "search_not_evaluated",
        ];
  return {
    contract_version: "response_trace_v2",
    authorities: {
      identity: "supabase",
      routing: "verbalsage_server_authority_v1",
      response_runtime: "resse_response_v0_2",
    },
    request: {
      request_id: rid,
      channel: voice ? "voice" : "text",
      transcript_persistence:
        responseInspection?.after_openai.transcript_persistence ||
        (noStore ? "skipped" : "persisted"),
    },
    authorization: {
      actor_verification: "supabase_fresh_user_lookup",
      execution_authorization: manualOverride
        ? "web_search.override"
        : "supabase_authenticated",
      inspection_capability: "inspector.view",
      inspection_verification: "supabase_fresh_user_lookup",
    },
    routing: {
      search_mode: searchMode,
      policy_version:
        automaticDecision?.policy_version || SEARCH_DECISION_POLICY_VERSION,
      decision:
        automaticDecision?.decision ||
        (manualOverride ? "manual_override" : "not_evaluated"),
      reason_codes: reasonCodes,
      policy_pack: automaticDecision?.policy_pack || "none",
      selected_route: "normal_chat",
      attempted_route: attemptedRoute,
      executed_external_web_access:
        automaticSearchRouteUsesExternalWebV1("normal_chat"),
      fallback_to_chat: fallbackToChat,
      budget: automaticDecision ? { ...automaticDecision.budget } : null,
    },
    execution: {
      web_searched: false,
      source_count: 0,
      validation: "passed",
    },
    timings,
    response_inspection: responseInspection,
  };
}

export async function POST(req: Request) {
  const rid = requestId(req);
  try {
    const body = await req.json().catch(() => ({}));
    const message =
      (typeof body?.input === "string" && body.input) ||
      (typeof body?.message === "string" && body.message) ||
      (Array.isArray(body?.messages) ? lastUserText(body.messages) : "") ||
      "";
    if (!message.trim()) {
      return new Response("Missing user message", {
        status: 400,
        headers: { "x-request-id": rid },
      });
    }
    const searchControl = resolveServerSearchControlV1(body);
    if (!searchControl) {
      return new Response("Invalid search control", {
        status: 400,
        headers: {
          "x-request-id": rid,
          "X-VS-Search-Authority": SERVER_SEARCH_AUTHORITY_VERSION,
        },
      });
    }

    const auth = await getFreshSupabaseAuthContextFromRequest(req);
    const allowGuest = process.env.VS_DEV_ALLOW_GUEST === "1";
    const devUser = String(process.env.VS_DEV_TEST_USER_ID || "").trim();
    const userId = auth?.user_id || (allowGuest ? devUser : "");
    if (!userId || !UUID_RE.test(userId)) {
      return new Response("unauthorized", {
        status: 401,
        headers: { "x-request-id": rid },
      });
    }
    const manualOverride =
      searchControl.effective_mode === "manual_override";
    const permissionRole = normalizePermissionRole(auth?.role);
    const automaticSearchAuthorized = Boolean(
      auth && capabilityAllowsRole("web_search.use", permissionRole),
    );
    if (manualOverride) {
      if (
        !auth ||
        !capabilityAllowsRole("web_search.override", permissionRole)
      ) {
        return new Response("capability required", {
          status: 403,
          headers: {
            "x-request-id": rid,
            "X-VS-Search-Authority": SERVER_SEARCH_AUTHORITY_VERSION,
          },
        });
      }
      recordManualSearchOverrideV1({
        actorUserId: userId,
        requestId: rid,
        route: "normal_chat",
        invocation: null,
      });
    }

    const voiceTurn = voiceTurnIdFromRequest(req);
    if (voiceTurn.supplied && !voiceTurn.value) {
      return new Response("invalid_voice_turn_id", {
        status: 400,
        headers: { "x-request-id": rid },
      });
    }
    const voiceSession = voiceSessionIdFromRequest(req);
    if (voiceTurn.value && (!voiceSession.supplied || !voiceSession.value)) {
      return new Response("invalid_or_missing_voice_session_id", {
        status: 409,
        headers: { "x-request-id": rid },
      });
    }

    const rawThread = String(body?.thread_id || "").trim();
    const threadId = UUID_RE.test(rawThread) ? rawThread : null;
    const noStore = shouldAvoidStorage(body, message);
    if (!noStore && !threadId) {
      return new Response("thread_id required", {
        status: 400,
        headers: { "x-request-id": rid },
      });
    }

    const includeInspection = await responseTraceAccessAllowedV2(req);
    const brains = process.env.BRAINS_URL || "http://172.31.32.171:8088";
    let automaticDecision: SearchDecisionV1 | null = null;
    let automaticAttemptedRoute: Exclude<
      AutomaticSearchRouteV1,
      "normal_chat"
    > | null = null;
    let automaticFallbackToChat = false;
    if (!manualOverride && automaticSearchAuthorized) {
      const searchResult = await runServerSearchPlan(
        req,
        rid,
        brains,
        userId,
        threadId,
        message,
        noStore,
        Boolean(voiceTurn.value || voiceSession.value),
      );
      if (searchResult.terminalResponse) {
        return searchResult.terminalResponse;
      }
      automaticDecision = searchResult.decision;
      automaticAttemptedRoute = searchResult.attemptedRoute;
      automaticFallbackToChat = searchResult.fallbackToChat;
      const selectedRoute = String(
        searchResult.response?.headers.get("X-VS-Search-Route") ||
          searchResult.attemptedRoute ||
          "normal_chat",
      ) as AutomaticSearchRouteV1;
      if (
        searchResult.response &&
        selectedRoute !== "normal_chat" &&
        automaticDecision
      ) {
        return routedSearchResponse(
          searchResult.response,
          selectedRoute,
          automaticDecision,
          rid,
          includeInspection,
        );
      }
    }

    const upstreamSignal = requestDeadlineSignal(
      BRAINS_RESPONSE_TIMEOUT_MS,
      req.signal,
    );
    if (!noStore) {
      const log = await fetch(`${brains}/log`, {
        method: "POST",
        headers: brainsUpstreamHeaders(rid, userId, {
          "Content-Type": "application/json",
          ...voiceTurnHeaders(voiceTurn.value),
          ...voiceSessionHeaders(voiceSession.value),
        }),
        body: JSON.stringify({
          user_id: userId,
          thread_id: threadId,
          source: "frontend/chat:user",
          text: message,
          tags: ["user", "chat"],
        }),
        cache: "no-store",
        signal: upstreamSignal,
      });
      if (!log.ok) {
        return new Response("Transcript write unavailable", {
          status: log.status === 409 ? 409 : 503,
          headers: { "x-request-id": rid },
        });
      }
    }

    const upstream = await fetch(`${brains}/response/query`, {
      method: "POST",
      headers: brainsUpstreamHeaders(rid, userId, {
        "Content-Type": "application/json",
        ...voiceTurnHeaders(voiceTurn.value),
        ...voiceSessionHeaders(voiceSession.value),
      }),
      body: JSON.stringify({
        user_id: userId,
        message,
        thread_id: threadId,
        no_store: noStore,
        include_inspection: includeInspection,
      }),
      cache: "no-store",
      signal: upstreamSignal,
    });
    const raw = await upstream.text().catch(() => "");
    if (!upstream.ok) {
      const timedOut = upstream.status === 504;
      const leaseLost = upstream.status === 409;
      return new Response(
        timedOut
          ? "Response timed out"
          : leaseLost
            ? "Voice session moved to another client"
            : "Response unavailable",
        {
          status: timedOut ? 504 : leaseLost ? 409 : 502,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "x-request-id": rid,
          },
        },
      );
    }
    if (
      voiceTurn.value &&
      upstream.headers.get("x-vs-voice-turn-id") !== voiceTurn.value
    ) {
      return new Response("voice_turn_correlation_lost", {
        status: 502,
        headers: { "x-request-id": rid },
      });
    }

    let answer = raw;
    let answerId = "";
    let responseInspection: ResponseInspectionV1 | null = null;
    let timings: ResponseTraceTimingV2 | null = null;
    try {
      const parsed = JSON.parse(raw);
      answer = String(parsed?.answer || "");
      answerId = String(parsed?.answer_id || "");
      responseInspection = responseInspectionV1FromValue(parsed?.inspection);
      timings = normalizedResponseTimings(parsed?.timings);
    } catch {}
    if (!answer) {
      return new Response("Empty response", {
        status: 502,
        headers: { "x-request-id": rid },
      });
    }

    const timingsHeader = responseTimingsHeader(timings);
    const traceHeaders = includeInspection
      ? responseTraceHeadersV2(
          ordinaryResponseTraceV2({
            rid,
            searchMode: searchControl.effective_mode,
            manualOverride,
            automaticDecision,
            attemptedRoute: automaticAttemptedRoute,
            fallbackToChat: automaticFallbackToChat,
            noStore,
            voice: Boolean(voiceTurn.value),
            timings,
            responseInspection,
          }),
        )
      : {};

    return new Response(answer, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-request-id": rid,
        "X-VS-Response-Runtime": "resse_response_v0_2",
        ...voiceTurnHeaders(voiceTurn.value),
        ...(answerId ? { "X-VS-Answer-Id": answerId } : {}),
        ...(timingsHeader ? { "X-VS-Response-Timings": timingsHeader } : {}),
        ...traceHeaders,
        "X-VS-Search-Authority": SERVER_SEARCH_AUTHORITY_VERSION,
        "X-VS-Search-Decision": manualOverride
          ? "manual_override"
          : automaticDecision?.decision || "no_search",
        "X-VS-Search-Policy":
          automaticDecision?.policy_pack || "none",
        "X-VS-Search-Route": "normal_chat",
      },
    });
  } catch (error: any) {
    const timedOut = isAbortLike(error);
    return new Response(
      timedOut ? "Response timed out" : "Response unavailable",
      {
        status: timedOut ? 504 : 502,
        headers: { "x-request-id": rid },
      },
    );
  }
}
