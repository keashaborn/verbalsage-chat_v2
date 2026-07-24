import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  BRAINS_TRANSCRIPTION_TIMEOUT_MS,
  isAbortLike,
  requestDeadlineSignal,
} from "@/lib/requestDeadline";
import { requireCapability } from "@/app/api/_auth/requireCapability";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import {
  voiceTurnHeaders,
  voiceTurnIdFromRequest,
} from "@/lib/voiceObservability";
import {
  voiceSessionHeaders,
  voiceSessionIdFromRequest,
} from "@/lib/voiceSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
  "video/mp4",
]);

function getRequestId(req: Request): string {
  const raw = (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    ""
  ).trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

function normalizedAudioType(raw: string | null): string {
  return String(raw || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const capability = await requireCapability(req, "voice.transcription");
  if (!capability.ok) {
    return NextResponse.json(
      { ok: false, error: capability.msg },
      { status: capability.status, headers: { "x-request-id": requestId } },
    );
  }

  const userId = String((capability as any)?.payload?.sub || "").trim();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  const voiceTurn = voiceTurnIdFromRequest(req);
  if (voiceTurn.supplied && !voiceTurn.value) {
    return NextResponse.json(
      { ok: false, error: "invalid_voice_turn_id" },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }
  const voiceSession = voiceSessionIdFromRequest(req);
  if (!voiceSession.supplied || !voiceSession.value) {
    return NextResponse.json(
      { ok: false, error: "invalid_or_missing_voice_session_id" },
      { status: 409, headers: { "x-request-id": requestId } },
    );
  }

  const contentType = normalizedAudioType(req.headers.get("content-type"));
  if (!SUPPORTED_AUDIO_TYPES.has(contentType)) {
    return NextResponse.json(
      { ok: false, error: "unsupported_audio_type" },
      { status: 415, headers: { "x-request-id": requestId } },
    );
  }

  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { ok: false, error: "audio_too_large", maximum_bytes: MAX_AUDIO_BYTES },
      { status: 413, headers: { "x-request-id": requestId } },
    );
  }

  const audio = await req.arrayBuffer();
  if (!audio.byteLength) {
    return NextResponse.json(
      { ok: false, error: "missing_audio" },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: "audio_too_large",
        maximum_bytes: MAX_AUDIO_BYTES,
        actual_bytes: audio.byteLength,
      },
      { status: 413, headers: { "x-request-id": requestId } },
    );
  }

  const brainsUrl = (
    process.env.BRAINS_URL || "http://172.31.32.171:8088"
  ).replace(/\/+$/, "");

  try {
    const upstream = await fetch(`${brainsUrl}/voice/openai/transcribe`, {
      method: "POST",
      cache: "no-store",
      headers: brainsUpstreamHeaders(requestId, userId, {
        "content-type": contentType,
        "x-vs-owner-user-id": userId,
        ...voiceTurnHeaders(voiceTurn.value),
        ...voiceSessionHeaders(voiceSession.value),
      }),
      body: audio,
      signal: requestDeadlineSignal(
        BRAINS_TRANSCRIPTION_TIMEOUT_MS,
        req.signal,
      ),
    });

    const responseBody = await upstream.text().catch(() => "");
    const upstreamRequestId = upstream.headers.get("x-request-id") || requestId;
    if (
      upstream.ok &&
      voiceTurn.value &&
      upstream.headers.get("x-vs-voice-turn-id") !== voiceTurn.value
    ) {
      return NextResponse.json(
        { ok: false, error: "voice_turn_correlation_lost" },
        { status: 502, headers: { "x-request-id": upstreamRequestId } },
      );
    }
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ||
          "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-request-id": upstreamRequestId,
        ...voiceTurnHeaders(voiceTurn.value),
      },
    });
  } catch (error: any) {
    const timedOut = isAbortLike(error);
    return NextResponse.json(
      {
        ok: false,
        error: timedOut ? "transcription_timeout" : "brains_unreachable",
      },
      {
        status: timedOut ? 504 : 502,
        headers: { "x-request-id": requestId },
      },
    );
  }
}
