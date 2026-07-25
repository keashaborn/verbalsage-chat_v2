export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import {
  BRAINS_RESPONSE_TIMEOUT_MS,
  isAbortLike,
  requestDeadlineSignal,
} from "@/lib/requestDeadline";
import { cookies } from "next/headers";
import { requireCapability } from "@/app/api/_auth/requireCapability";
import {
  getSupabaseAuthContextFromRequest,
  getSupabaseBearerAuthorizationFromRequest,
} from "@/app/api/_auth/supabaseUser";
import {
  decideSearchV1,
  recordSearchDecisionShadowV1,
  recordSearchRoutingEnforcedV1,
  selectAutomaticSearchRouteV1,
  type AutomaticSearchRouteV1,
  type SearchDecisionV1,
} from "@/lib/searchDecisionV1";
import { POST as postCurrentNews } from "@/app/api/current-news/route";
import { POST as postTrustedWeb } from "@/app/api/trusted-web/route";
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
  inspectorSessionCookieName,
  inspectorSessionEnabled,
} from "@/lib/inspectorSession";

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
type SearchMode = "off" | "auto";

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

function searchModeFromBody(body: any): SearchMode | null {
  const raw = body?.search_mode;
  if (raw === undefined) return "off";
  return raw === "off" || raw === "auto" ? raw : null;
}

async function responseInspectionAllowed(req: Request): Promise<boolean> {
  const capability = await requireCapability(req, "inspector.view");
  if (!capability.ok) return false;
  const jar = await cookies();
  return inspectorSessionEnabled(jar.get(inspectorSessionCookieName())?.value);
}

function responseTimingsHeader(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const source = value as Record<string, unknown>;
  const timings: Record<string, number> = {};
  for (const key of RESPONSE_TIMING_KEYS) {
    const number = Number(source[key]);
    if (!Number.isFinite(number) || number < 0 || number > 600_000) continue;
    timings[key] = Math.round(number);
  }
  if (!("backend_total_ms" in timings)) return "";
  return Buffer.from(JSON.stringify(timings), "utf8").toString("base64url");
}

function automaticSearchRequest(
  req: Request,
  rid: string,
  route: Exclude<AutomaticSearchRouteV1, "normal_chat">,
  query: string,
): Request | null {
  const authorization = getSupabaseBearerAuthorizationFromRequest(req);
  if (!authorization) return null;
  return new Request(`https://verbalsage.internal/api/${route}`, {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
      "x-request-id": rid,
    },
    body: JSON.stringify({ query }),
    cache: "no-store",
    signal: req.signal,
  });
}

function routedSearchResponse(
  response: Response,
  route: Exclude<AutomaticSearchRouteV1, "normal_chat">,
  decision: SearchDecisionV1,
): Response {
  const headers = new Headers(response.headers);
  headers.set("X-VS-Search-Authority", "server_v1");
  headers.set("X-VS-Search-Decision", decision.decision);
  headers.set("X-VS-Search-Policy", decision.policy_pack);
  headers.set("X-VS-Search-Route", route);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function runAutomaticSearch(
  req: Request,
  rid: string,
  route: AutomaticSearchRouteV1,
  decision: SearchDecisionV1,
  message: string,
): Promise<Response | null> {
  if (route === "normal_chat") return null;
  const delegated = automaticSearchRequest(req, rid, route, message);
  if (!delegated) return null;
  const response =
    route === "current_news"
      ? await postCurrentNews(delegated)
      : await postTrustedWeb(delegated);
  if (
    route === "trusted_health" &&
    response.headers.get("X-VS-Trusted-Web-Fallback") === "chat"
  ) {
    return null;
  }
  return routedSearchResponse(response, route, decision);
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
    const searchMode = searchModeFromBody(body);
    if (!searchMode) {
      return new Response("Invalid search mode", {
        status: 400,
        headers: { "x-request-id": rid },
      });
    }

    const auth = await getSupabaseAuthContextFromRequest(req);
    const allowGuest = process.env.VS_DEV_ALLOW_GUEST === "1";
    const devUser = String(process.env.VS_DEV_TEST_USER_ID || "").trim();
    const userId = auth?.user_id || (allowGuest ? devUser : "");
    if (!userId || !UUID_RE.test(userId)) {
      return new Response("unauthorized", {
        status: 401,
        headers: { "x-request-id": rid },
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

    let automaticDecision: SearchDecisionV1 | null = null;
    if (
      searchMode === "auto" &&
      !noStore &&
      !voiceTurn.value &&
      !voiceSession.value
    ) {
      automaticDecision = decideSearchV1(message);
      let selectedRoute = selectAutomaticSearchRouteV1(automaticDecision);
      if (!getSupabaseBearerAuthorizationFromRequest(req)) {
        selectedRoute = "normal_chat";
      }
      recordSearchRoutingEnforcedV1({
        actorUserId: userId,
        requestId: rid,
        selectedRoute,
        input: message,
        decision: automaticDecision,
      });
      const searchResponse = await runAutomaticSearch(
        req,
        rid,
        selectedRoute,
        automaticDecision,
        message,
      );
      if (searchResponse) return searchResponse;
    } else if (!noStore) {
      recordSearchDecisionShadowV1({
        actorUserId: userId,
        requestId: rid,
        observedRoute: "normal_chat",
        input: message,
      });
    }
    const includeInspection = await responseInspectionAllowed(req);

    const brains = process.env.BRAINS_URL || "http://172.31.32.171:8088";
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
    let inspection: unknown = null;
    let timingsHeader = "";
    try {
      const parsed = JSON.parse(raw);
      answer = String(parsed?.answer || "");
      answerId = String(parsed?.answer_id || "");
      inspection = parsed?.inspection || null;
      timingsHeader = responseTimingsHeader(parsed?.timings);
    } catch {}
    if (!answer) {
      return new Response("Empty response", {
        status: 502,
        headers: { "x-request-id": rid },
      });
    }

    const inspectionHeader =
      includeInspection && inspection
        ? Buffer.from(JSON.stringify(inspection), "utf8").toString("base64url")
        : "";
    const boundedInspectionHeader =
      inspectionHeader && Buffer.byteLength(inspectionHeader, "ascii") <= 6000
        ? inspectionHeader
        : "";
    const inspectionStatus = includeInspection
      ? boundedInspectionHeader
        ? "available"
        : "unavailable"
      : "disabled";

    return new Response(answer, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-request-id": rid,
        "X-VS-Response-Runtime": "resse_response_v0_2",
        ...voiceTurnHeaders(voiceTurn.value),
        ...(answerId ? { "X-VS-Answer-Id": answerId } : {}),
        ...(timingsHeader ? { "X-VS-Response-Timings": timingsHeader } : {}),
        ...(boundedInspectionHeader
          ? { "X-VS-Inspection": boundedInspectionHeader }
          : {}),
        ...(includeInspection
          ? { "X-VS-Inspection-Status": inspectionStatus }
          : {}),
        ...(searchMode === "auto"
          ? {
              "X-VS-Search-Authority": "server_v1",
              "X-VS-Search-Decision":
                automaticDecision?.decision || "no_search",
              "X-VS-Search-Policy":
                automaticDecision?.policy_pack || "none",
              "X-VS-Search-Route": "normal_chat",
            }
          : {}),
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
