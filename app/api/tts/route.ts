import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_TTS_CHARACTERS = 4096;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  try {
    const userId = await getSupabaseUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: { "x-request-id": requestId } }
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
        { status: 400, headers: { "x-request-id": requestId } }
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

    const BRAINS_URL = (process.env.BRAINS_URL || "http://172.31.32.171:8088").replace(/\/+$/, "");
    const upstream = await fetch(`${BRAINS_URL}/voice/tts`, {
      method: "POST",
      cache: "no-store",
      headers: brainsUpstreamHeaders(requestId, userId, {
        "content-type": "application/json; charset=utf-8",
      }),
      body: JSON.stringify({
        text,
        voice,
        model,
        speed,
        instructions,
      }),
    });

    const rid = upstream.headers.get("x-request-id") || requestId;
    const contentType = upstream.headers.get("content-type") || "";

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      return new Response(errText || `TTS upstream error: HTTP ${upstream.status}`, {
        status: upstream.status,
        headers: {
          "content-type": contentType || "text/plain; charset=utf-8",
          "x-request-id": rid,
        },
      });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    return new Response(buf, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") || "audio/mpeg",
        "x-request-id": rid,
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "tts_proxy_error", detail: String(e?.message || e) },
      { status: 500, headers: { "x-request-id": requestId } }
    );
  }
}
