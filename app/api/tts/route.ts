import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  isAbortLike,
  requestDeadlineSignal,
  TTS_SEGMENT_TIMEOUT_MS,
} from "@/lib/requestDeadline";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";
import {
  voiceTurnHeaders,
  voiceTurnIdFromRequest,
} from "@/lib/voiceObservability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_TTS_CHARACTERS = 4096;
const TTS_UPSTREAM_RETRY_DELAYS_MS = [0, 300, 1200];
const RETRYABLE_UPSTREAM_STATUSES = new Set([429, 500, 502, 503, 504]);

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function getRequestId(req: Request): string {
  const raw = (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    ""
  ).trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function ttsSegmentHeaders(req: Request): Record<string, string> | null {
  const rawIndex = req.headers.get("x-vs-tts-segment-index");
  const rawCount = req.headers.get("x-vs-tts-segment-count");
  if (rawIndex == null && rawCount == null) return {};
  if (rawIndex == null || rawCount == null) return null;
  const index = Number(rawIndex);
  const count = Number(rawCount);
  if (
    !Number.isInteger(index) ||
    !Number.isInteger(count) ||
    index < 0 ||
    count < 1 ||
    count > 256 ||
    index >= count
  ) {
    return null;
  }
  return {
    "x-vs-tts-segment-index": String(index),
    "x-vs-tts-segment-count": String(count),
  };
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  try {
    const userId = await getSupabaseUserIdFromRequest(req);
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
    const segmentHeaders = ttsSegmentHeaders(req);
    if (!segmentHeaders) {
      return NextResponse.json(
        { ok: false, error: "invalid_tts_segment_metadata" },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }

    const body = await req.json().catch(() => ({}));

    const text = String(body?.text ?? "").trim();
    const voice = String(body?.voice ?? "sage").trim();
    const model = String(body?.model ?? "gpt-4o-mini-tts").trim();
    const instructions = String(body?.instructions ?? "").trim();

    let speed = Number(body?.speed ?? 1.0);
    if (!Number.isFinite(speed)) speed = 1.0;
    speed = clamp(speed, 0.25, 4.0);

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "missing_text" },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }

    if (text.length > MAX_TTS_CHARACTERS) {
      return NextResponse.json(
        {
          ok: false,
          error: "text_too_long",
          maximum_characters: MAX_TTS_CHARACTERS,
          actual_characters: text.length,
        },
        { status: 413, headers: { "x-request-id": requestId } },
      );
    }

    const BRAINS_URL = (
      process.env.BRAINS_URL || "http://172.31.32.171:8088"
    ).replace(/\/+$/, "");
    const upstreamBody = JSON.stringify({
      text,
      voice,
      model,
      speed,
      instructions,
    });
    let upstream: Response | null = null;
    let lastTransportError: unknown = null;
    const upstreamSignal = requestDeadlineSignal(
      TTS_SEGMENT_TIMEOUT_MS,
      req.signal,
    );

    for (
      let attempt = 0;
      attempt < TTS_UPSTREAM_RETRY_DELAYS_MS.length;
      attempt += 1
    ) {
      const delay = TTS_UPSTREAM_RETRY_DELAYS_MS[attempt];
      if (delay > 0) await wait(delay);

      try {
        const candidate = await fetch(`${BRAINS_URL}/voice/tts`, {
          method: "POST",
          cache: "no-store",
          headers: brainsUpstreamHeaders(requestId, userId, {
            "content-type": "application/json; charset=utf-8",
            ...voiceTurnHeaders(voiceTurn.value),
            ...segmentHeaders,
          }),
          body: upstreamBody,
          signal: upstreamSignal,
        });
        upstream = candidate;
        lastTransportError = null;
        if (
          candidate.ok ||
          !RETRYABLE_UPSTREAM_STATUSES.has(candidate.status) ||
          attempt === TTS_UPSTREAM_RETRY_DELAYS_MS.length - 1
        ) {
          break;
        }
        await candidate.arrayBuffer().catch(() => new ArrayBuffer(0));
      } catch (error) {
        upstream = null;
        lastTransportError = error;
        if (
          upstreamSignal.aborted ||
          attempt === TTS_UPSTREAM_RETRY_DELAYS_MS.length - 1
        ) {
          break;
        }
      }
    }

    if (!upstream) {
      throw new Error(
        `TTS backend unavailable after retry: ${String(
          (lastTransportError as any)?.message ||
            lastTransportError ||
            "fetch failed",
        )}`,
      );
    }

    const rid = upstream.headers.get("x-request-id") || requestId;
    const contentType = upstream.headers.get("content-type") || "";

    if (
      upstream.ok &&
      voiceTurn.value &&
      upstream.headers.get("x-vs-voice-turn-id") !== voiceTurn.value
    ) {
      await upstream.body?.cancel().catch(() => {});
      return NextResponse.json(
        { ok: false, error: "voice_turn_correlation_lost" },
        { status: 502, headers: { "x-request-id": rid } },
      );
    }

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      return new Response(
        errText || `TTS upstream error: HTTP ${upstream.status}`,
        {
          status: upstream.status,
          headers: {
            "content-type": contentType || "text/plain; charset=utf-8",
            "x-request-id": rid,
            ...voiceTurnHeaders(voiceTurn.value),
            ...segmentHeaders,
          },
        },
      );
    }

    if (!upstream.body) {
      return NextResponse.json(
        { ok: false, error: "tts_upstream_stream_missing" },
        { status: 502, headers: { "x-request-id": rid } },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") || "audio/pcm",
        "x-request-id": rid,
        "cache-control": "no-store",
        ...(upstream.headers.get("x-vs-audio-format")
          ? {
              "x-vs-audio-format": upstream.headers.get("x-vs-audio-format")!,
            }
          : {}),
        ...(upstream.headers.get("x-vs-audio-sample-rate")
          ? {
              "x-vs-audio-sample-rate": upstream.headers.get(
                "x-vs-audio-sample-rate",
              )!,
            }
          : {}),
        ...(upstream.headers.get("x-vs-provider-request-id")
          ? {
              "x-vs-provider-request-id": upstream.headers.get(
                "x-vs-provider-request-id",
              )!,
            }
          : {}),
        ...voiceTurnHeaders(voiceTurn.value),
        ...segmentHeaders,
      },
    });
  } catch (e: any) {
    const timedOut = isAbortLike(e);
    return NextResponse.json(
      { ok: false, error: timedOut ? "tts_timeout" : "tts_proxy_error" },
      {
        status: timedOut ? 504 : 502,
        headers: { "x-request-id": requestId },
      },
    );
  }
}
