export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

async function getUserIdFromCookie(): Promise<string | null> {
  if (!JWKS || !process.env.SUPABASE_ISSUER) return null;
  const jar = await cookies();
  const token = jar.get("vs_at")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: process.env.SUPABASE_ISSUER });
    return (payload?.sub as string) || null;
  } catch {
    return null;
  }
}

function clamp01(x: any, d: number) {
  const n = Number(x);
  if (!Number.isFinite(n)) return d;
  return Math.max(0, Math.min(1, n));
}

function clampInt(x: any, lo: number, hi: number, d: number) {
  const n = Number(x);
  if (!Number.isFinite(n)) return d;
  const v = Math.round(n);
  return v < lo ? lo : v > hi ? hi : v;
}

function sanitizeLimits(raw: any): { Y: number; R: number; C: number; S: number } | null {
  if (!raw || typeof raw !== "object") return null;

  // Defaults must match UI (components/admin/settings/VantageProfilePage.tsx + store.tsx)
  const r: any = raw as any;
  return {
    Y: clamp01(r.Y, 0.1),
    R: clamp01(r.R, 0.2),
    C: clamp01(r.C, 0.4),
    S: clamp01(r.S, 0.4),
  };
}

function sanitizeRouting(
  raw: any
): { answer_first: boolean; clarify_bias: number; max_clarify_questions: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const r: any = raw as any;

  return {
    // If field is missing (older cookie), keep default = true (NOT false).
    answer_first: typeof r.answer_first === "boolean" ? r.answer_first : true,
    clarify_bias: clamp01(r.clarify_bias, 0.1),
    max_clarify_questions: clampInt(r.max_clarify_questions, 0, 3, 1),
  };
}

function sanitizeMix(raw: any): any | null {
  if (!raw || typeof raw !== "object") return null;

  // Defaults must match UI (components/admin/settings/VantageProfilePage.tsx + store.tsx)
  const m: any = raw as any;
  return {
    conversation: clamp01(m.conversation, 0.6),
    memory_cards: clamp01(m.memory_cards, 0.7),
    corpus: clamp01(m.corpus, 0.8),
    lens_fm: clamp01(m.lens_fm, 0.8),
    recency_bias: clamp01(m.recency_bias, 0.6),
    similarity_threshold: clamp01(m.similarity_threshold, 0.4),
  };
}

function sanitizePragmatics(raw: any): { rfg: number; df: number; pe: number } | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    rfg: clamp01(raw.rfg, 0.0),
    df: clamp01(raw.df, 0.7),
    pe: clampInt(raw.pe, 0, 3, 2),
  };
}

function sanitizeRoleplay(raw: any): { on: boolean; strict: boolean; script: string } | null {
  if (!raw || typeof raw !== "object") return null;

  const on = !!(raw as any).on;
  const strict = !!(raw as any).strict;

  const script =
    typeof (raw as any).script === "string" ? String((raw as any).script).slice(0, 4096) : "";

  if (!on && !strict && !script) return null;
  return { on, strict, script };
}

export async function POST(req: Request) {
  try {
    const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";
    const jar = await cookies();

    // Debug gate (same rule as /api/chat)
    const debugTokenHdr = req.headers.get("x-vs-debug-token") || "";
    const debugTokenCookie = jar.get("vs_debug_token")?.value || "";
    const debugAllowed =
      !!process.env.VS_DEBUG_TOKEN &&
      (debugTokenHdr === process.env.VS_DEBUG_TOKEN ||
        debugTokenCookie === process.env.VS_DEBUG_TOKEN);

    if (!debugAllowed) return new Response("unauthorized", { status: 401 });

    // Primary: Supabase user_id from vs_at JWT
    const authedUserId = await getUserIdFromCookie();

    // Dev fallback (optional)
    const allowGuest = process.env.VS_DEV_ALLOW_GUEST === "1";
    const devTestUser = (process.env.VS_DEV_TEST_USER_ID || "").trim();

    const user_id = authedUserId || (allowGuest && devTestUser ? devTestUser : "");
    if (!user_id) return new Response("unauthorized", { status: 401 });

    let body: any = {};
    try {
      body = await req.json();
    } catch { }

    const msg = String(body?.message || body?.input || "").trim();
    if (!msg) return new Response("Missing message", { status: 400 });

    const rawTid = String(body?.thread_id || jar.get("vs_tid")?.value || "").trim();
    const thread_id = UUID_RE.test(rawTid) ? rawTid : null;

    const rawVid = String(body?.vantage_id || jar.get("vs_vantage_id")?.value || "").trim();
    const vantage_id = rawVid ? rawVid.slice(0, 64) : "default";

    const rawModel = String(body?.model || jar.get("vs_model")?.value || "").trim();
    const modelAllowed = new Set(["gpt-5.2", "gpt-5.1", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "xai:grok-3", "xai:grok-3-mini", "xai:grok-4-0709", "xai:grok-4-1-fast-non-reasoning", "xai:grok-4-1-fast-reasoning", "xai:grok-4-fast-non-reasoning", "xai:grok-4-fast-reasoning", "xai:grok-code-fast-1", "xai:grok-2-vision-1212", "xai:grok-2-image-1212"]);
    const model = modelAllowed.has(rawModel) ? rawModel : null;

    // limits from body OR cookie (so Inspector reflects the real budgets)
    let limits: any = sanitizeLimits(body?.limits);
    if (!limits) {
      const rawCookie = jar.get("vs_vantage_limits")?.value;
      if (rawCookie) {
        try {
          limits = sanitizeLimits(JSON.parse(decodeURIComponent(rawCookie)));
        } catch { }
      }
    }

    // routing from body OR cookie (so decision/clarify shape matches)
    let routing: any = sanitizeRouting(body?.routing);
    if (!routing) {
      const rawCookie = jar.get("vs_vantage_routing")?.value;
      if (rawCookie) {
        try {
          routing = sanitizeRouting(JSON.parse(decodeURIComponent(rawCookie)));
        } catch { }
      }
    }

    // mix from body OR cookie OR default
    let mix: any = sanitizeMix(body?.mix);
    if (!mix) {
      const rawCookie = jar.get("vs_vantage_mix")?.value;
      if (rawCookie) {
        try {
          mix = sanitizeMix(JSON.parse(decodeURIComponent(rawCookie)));
        } catch { }
      }
    }
    if (!mix) mix = sanitizeMix({});

    const top_k = Number(body?.top_k || 5) || 5;

    // pragmatics from body OR cookie
    let pragmatics: any = sanitizePragmatics((body as any)?.pragmatics);
    if (!pragmatics) {
      const rawCookie = jar.get("vs_vantage_pragmatics")?.value;
      if (rawCookie) {
        try {
          pragmatics = sanitizePragmatics(JSON.parse(decodeURIComponent(rawCookie)));
        } catch { }
      }
    }

    // roleplay from request body OR cookie
    let roleplay: any = sanitizeRoleplay((body as any)?.roleplay);
    if (!roleplay) {
      const rawCookie = jar.get("vs_vantage_roleplay")?.value;
      if (rawCookie) {
        try {
          roleplay = sanitizeRoleplay(JSON.parse(decodeURIComponent(rawCookie)));
        } catch { }
      }
    }

    // Call Brains with inspect_only + debug
    const r = await fetch(`${BRAINS_URL}/vantage/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id,
        message: msg,
        thread_id,
        top_k,
        inspect_only: true,
        debug: true,
        ...(model ? { model } : {}),
        vantage_id,
        mix,
        ...(limits ? { limits } : {}),
        ...(routing ? { routing } : {}),
        ...(pragmatics ? { pragmatics } : {}),
        ...(roleplay ? { definition_overlay: roleplay } : {}),
      }),
    });

    const raw = await r.text();
    return new Response(raw, {
      status: r.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (err: any) {
    return new Response(`Route error: ${err?.message || String(err)}`, { status: 500 });
  }
}
