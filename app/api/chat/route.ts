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
import { getSupabaseAuthContextFromRequest } from "@/app/api/_auth/supabaseUser";
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
    if (
      voiceTurn.value &&
      (!voiceSession.supplied || !voiceSession.value)
    ) {
      return new Response("invalid_or_missing_voice_session_id", {
        status: 409,
        headers: { "x-request-id": rid },
      });
    }

    const rawThread = String(body?.thread_id || "").trim();
    const threadId = UUID_RE.test(rawThread) ? rawThread : null;
    const noStore = shouldAvoidStorage(body, message);
    const includeInspection = await responseInspectionAllowed(req);
    if (!noStore && !threadId) {
      return new Response("thread_id required", {
        status: 400,
        headers: { "x-request-id": rid },
      });
    }

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
