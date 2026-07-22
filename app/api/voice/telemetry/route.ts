import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import { normalizeVoiceTurnId } from "@/lib/voiceObservability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[a-zA-Z0-9._:-]{1,160}$/;
const STATUSES = new Set(["completed", "failed", "cancelled"]);
const FAILURE_STAGES = new Set(["none", "transcription", "response", "tts"]);

function boundedInteger(value: unknown, maximum = 600_000): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(maximum, Math.round(number)));
}

function boundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const bounded = Math.max(minimum, Math.min(maximum, number));
  return Math.round(bounded * 1_000_000) / 1_000_000;
}

function boundedToken(value: unknown): string {
  const token = String(value || "").trim();
  return TOKEN_RE.test(token) ? token : "";
}

function boundedTokenList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(boundedToken).filter(Boolean).slice(0, 64);
}

function requestId(req: Request): string {
  const raw = (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    ""
  ).trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

export async function POST(req: Request) {
  const rid = requestId(req);
  const userId = await getSupabaseUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "x-request-id": rid } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const voiceTurnId = normalizeVoiceTurnId(body?.voice_turn_id);
  const threadId = String(body?.thread_id || "")
    .trim()
    .toLowerCase();
  const answerId = String(body?.answer_id || "")
    .trim()
    .toLowerCase();
  if (!voiceTurnId || !UUID_RE.test(threadId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_voice_trace_identity" },
      { status: 400, headers: { "x-request-id": rid } },
    );
  }
  if (answerId && !UUID_RE.test(answerId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_answer_id" },
      { status: 400, headers: { "x-request-id": rid } },
    );
  }

  const status = STATUSES.has(String(body?.status))
    ? String(body.status)
    : "failed";
  const failureStage = FAILURE_STAGES.has(String(body?.failure_stage))
    ? String(body.failure_stage)
    : status === "completed"
      ? "none"
      : "response";

  const payload = {
    contract_version: "voice_turn_trace_v1",
    status,
    failure_stage: failureStage,
    speech_ms: boundedInteger(body?.speech_ms),
    audio_bytes: boundedInteger(body?.audio_bytes, 8 * 1024 * 1024),
    transcription_ms: boundedInteger(body?.transcription_ms),
    response_ms: boundedInteger(body?.response_ms),
    tts_first_audio_ms: boundedInteger(body?.tts_first_audio_ms),
    speech_to_first_audio_ms: boundedInteger(body?.speech_to_first_audio_ms),
    tts_total_ms: boundedInteger(body?.tts_total_ms, 3_600_000),
    total_turn_ms: boundedInteger(body?.total_turn_ms, 3_600_000),
    tts_segment_count: boundedInteger(body?.tts_segment_count, 256),
    transcription_provider: boundedToken(body?.transcription_provider),
    transcription_model: boundedToken(body?.transcription_model),
    transcription_language: boundedToken(body?.transcription_language),
    transcription_confidence_token_count: boundedInteger(
      body?.transcription_confidence_token_count,
      32_000,
    ),
    transcription_confidence_mean_logprob: boundedNumber(
      body?.transcription_confidence_mean_logprob,
      -100,
      0,
    ),
    transcription_confidence_minimum_logprob: boundedNumber(
      body?.transcription_confidence_minimum_logprob,
      -100,
      0,
    ),
    transcription_low_confidence_token_count: boundedInteger(
      body?.transcription_low_confidence_token_count,
      32_000,
    ),
    transcription_request_id: boundedToken(body?.transcription_request_id),
    transcription_provider_request_id: boundedToken(
      body?.transcription_provider_request_id,
    ),
    response_request_id: boundedToken(body?.response_request_id),
    tts_model: boundedToken(body?.tts_model),
    tts_voice: boundedToken(body?.tts_voice),
    tts_request_ids: boundedTokenList(body?.tts_request_ids),
    tts_provider_request_ids: boundedTokenList(body?.tts_provider_request_ids),
    answer_id: answerId || null,
  };

  const brainsUrl = (
    process.env.BRAINS_URL || "http://172.31.32.171:8088"
  ).replace(/\/+$/, "");
  const event = {
    event_id: randomUUID(),
    event_type: "voice.turn.trace",
    subject_type: "voice_turn",
    subject_id: voiceTurnId,
    thread_id: threadId,
    turn_id: voiceTurnId,
    target_model_id: payload.tts_model || null,
    target_model_version: null,
    payload,
    occurred_at: new Date().toISOString(),
  };

  const upstream = await fetch(`${brainsUrl}/telemetry/event`, {
    method: "POST",
    cache: "no-store",
    headers: brainsUpstreamHeaders(rid, userId, {
      "content-type": "application/json; charset=utf-8",
      "x-vs-voice-turn-id": voiceTurnId,
    }),
    body: JSON.stringify({ events: [event] }),
  });
  const responseBody = await upstream.text().catch(() => "");
  return new Response(responseBody, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ||
        "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-request-id": rid,
      "x-vs-voice-turn-id": voiceTurnId,
    },
  });
}
