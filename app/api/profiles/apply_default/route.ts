export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";


async function getUserIdOrDevFallback(req: Request): Promise<string | null> {
  const uid = await getSupabaseUserIdFromRequest(req);
  if (uid) return uid;

  // Dev escape hatch (mirror /api/chat)
  const allowGuest = process.env.VS_DEV_ALLOW_GUEST === "1";
  const devTestUser = (process.env.VS_DEV_TEST_USER_ID || "").trim();
  if (allowGuest && devTestUser) return devTestUser;

  return null;
}

function clamp01(x: any, d: number) {
  const n = Number(x);
  if (!Number.isFinite(n)) return d;
  return Math.max(0, Math.min(1, n));
}

function parsePayloadMaybe(payload: any): any {
  if (!payload) return {};
  if (typeof payload === "object") return payload;
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return {};
}

export async function POST(req: Request) {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  const requestId = (raw || crypto.randomUUID()).slice(0, 128);

  try {
    const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";

    const user_id = await getUserIdOrDevFallback(req);
    if (!user_id) return new Response("unauthorized", { status: 401, headers: { "x-request-id": requestId } });

    const upstream = await fetch(`${BRAINS_URL}/profiles/${encodeURIComponent(user_id)}/default`, {
      method: "GET",
      headers: brainsUpstreamHeaders(requestId, user_id, { "Content-Type": "application/json" }),
    });

    const txt = await upstream.text().catch(() => "");
    const rid = upstream.headers.get("x-request-id") || requestId;

    if (!upstream.ok) {
      return new Response(txt || `Brains HTTP ${upstream.status}`, {
        status: 502,
        headers: { "x-request-id": rid },
      });
    }

    let data: any = {};
    try {
      data = JSON.parse(txt);
    } catch {
      return new Response("brains returned invalid json", { status: 502, headers: { "x-request-id": rid } });
    }

    const payloadRaw = data?.profile?.payload;
    const payload = parsePayloadMaybe(payloadRaw);

    const rawModel = String(payload?.model || "").trim();
    const rawVid = String(payload?.vantage_id || "").trim();

    // allowlist models
    const modelAllowed = new Set([
      "gpt-5.2", "gpt-5.1", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini",
      "xai:grok-3", "xai:grok-3-mini", "xai:grok-4-0709",
      "xai:grok-4-1-fast-non-reasoning", "xai:grok-4-1-fast-reasoning",
      "xai:grok-4-fast-non-reasoning", "xai:grok-4-fast-reasoning",
      "xai:grok-code-fast-1", "xai:grok-2-vision-1212", "xai:grok-2-image-1212"
    ]);
    const model = modelAllowed.has(rawModel) ? rawModel : "";

    const vantage_id = rawVid ? rawVid.slice(0, 64) : "";

    const mixIn = payload?.mix && typeof payload.mix === "object" ? payload.mix : {};
    const mix = {
      conversation: clamp01(mixIn.conversation, 0.70),
      memory_cards: clamp01(mixIn.memory_cards, 0.20),
      corpus: clamp01(mixIn.corpus, 0.10),
      lens_fm: clamp01(mixIn.lens_fm, 0.00),
      recency_bias: clamp01(mixIn.recency_bias, 0.80),
      similarity_threshold: clamp01(mixIn.similarity_threshold, 0.25),
    };

    const jar = await cookies();
    const maxAge = 60 * 60 * 24 * 30;

    // IMPORTANT: do NOT pre-encode with encodeURIComponent here.
    // Next's cookie serializer encodes values; pre-encoding caused %257B double-encoding.
    if (model) jar.set("vs_model", model, { path: "/", sameSite: "lax", maxAge });
    if (vantage_id) jar.set("vs_vantage_id", vantage_id, { path: "/", sameSite: "lax", maxAge });
    jar.set("vs_vantage_mix", JSON.stringify(mix), { path: "/", sameSite: "lax", maxAge });

    return new Response(JSON.stringify({ status: "ok", applied: { user_id, model, vantage_id, mix } }), {
      headers: { "Content-Type": "application/json; charset=utf-8", "x-request-id": rid },
    });
  } catch (e: any) {
    return new Response(`Route error: ${e?.message || String(e)}`, { status: 500, headers: { "x-request-id": requestId } });
  }
}
