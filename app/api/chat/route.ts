export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getSupabaseAuthContextFromRequest } from "@/app/api/_auth/supabaseUser";


const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}

function brainsHeaders(requestId: string, actorUserId?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-id": requestId,
  };

  const serviceToken = (process.env.VS_SERVICE_TOKEN || "").trim();
  if (serviceToken) headers["x-vs-service-token"] = serviceToken;

  const actor = String(actorUserId || "").trim();
  if (actor) headers["x-vs-actor-user-id"] = actor;

  return headers;
}


function extractTextFromMessages(messages: any[]): string {
  const lastUser = [...messages].reverse().find((m: any) => m?.role === "user");
  if (!lastUser) return "";

  if (typeof lastUser.content === "string") return lastUser.content;

  if (Array.isArray(lastUser.parts)) {
    return lastUser.parts
      .map((p: any) => (p?.type === "text" ? p.text : p?.text ?? ""))
      .join("");
  }

  if (Array.isArray(lastUser.content)) {
    return lastUser.content.map((p: any) => p?.text ?? "").join("");
  }

  return "";
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
  return {
    Y: clamp01((raw as any).Y, 0.1),
    R: clamp01((raw as any).R, 0.2),
    C: clamp01((raw as any).C, 0.4),
    S: clamp01((raw as any).S, 0.4),
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

  const clamp01Local = (x: any, d: number) => {
    const n = Number(x);
    if (!Number.isFinite(n)) return d;
    return Math.max(0, Math.min(1, n));
  };

  // Defaults must match UI (components/admin/settings/VantageProfilePage.tsx + store.tsx)
  const m: any = raw as any;
  return {
    conversation: clamp01Local(m.conversation, 0.6),
    memory_cards: clamp01Local(m.memory_cards, 0.7),
    corpus: clamp01Local(m.corpus, 0.8),
    lens_fm: clamp01Local(m.lens_fm, 0.8),
    recency_bias: clamp01Local(m.recency_bias, 0.6),
    similarity_threshold: clamp01Local(m.similarity_threshold, 0.4),
  };
}

function sanitizePragmatics(raw: any): { rfg: number; df: number; pe: number } | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    rfg: clamp01((raw as any).rfg, 0.0),
    df: clamp01((raw as any).df, 0.7),
    pe: clampInt((raw as any).pe, 0, 3, 2),
  };
}

function enforceVantagePermissions(args: {
  isAdmin: boolean;
  mix: any | null;
  routing: any | null;
  limits: any | null;
  pragmatics: any | null;
}) {
  if (args.isAdmin) return args;

  // Normal users may adjust visible Assistant Profile controls only.
  // Admin-only controls are stripped server-side even if manually sent in body/cookies.
  const safeMix = args.mix
    ? {
        conversation: args.mix.conversation,
        memory_cards: args.mix.memory_cards,
        corpus: args.mix.corpus,
        lens_fm: args.mix.lens_fm,
      }
    : null;

  return {
    isAdmin: args.isAdmin,
    mix: safeMix,
    routing: args.routing,
    limits: null,
    pragmatics: null,
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
  const requestId = getRequestId(req);
  try {
    const rawBody = await req.text();
    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch { }

    const msg =
      (typeof body.input === "string" && body.input) ||
      (typeof body.message === "string" && body.message) ||
      (Array.isArray(body.messages) ? extractTextFromMessages(body.messages) : "") ||
      "";

    // noStore: do not write these messages into /log (prevents retrieval pollution)
    const msgLower = msg.trim().toLowerCase();
    const TEST_PREFIXES = [
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

    const noStore =
      body?.noStore === true ||
      body?.debug === true ||
      TEST_PREFIXES.some((p) => msgLower.startsWith(p));

    if (!msg.trim()) {
      return new Response("Missing user message", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8", "x-request-id": requestId },
      });
    }

    const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";

    const jar = await cookies();
    const authCtx = await getSupabaseAuthContextFromRequest(req);

    // DEV escape hatch (OFF by default)
    const allowGuest = process.env.VS_DEV_ALLOW_GUEST === "1";
    const devTestUser = (process.env.VS_DEV_TEST_USER_ID || "").trim();

    let user_id: string;
    let isAdmin = false;

    if (authCtx?.user_id) {
      user_id = authCtx.user_id;
      isAdmin = !!authCtx.is_admin;
    } else if (allowGuest && devTestUser) {
      // dev-only: force a stable test user id for local/manual testing
      user_id = devTestUser;
    } else {
      return new Response("unauthorized", {
        status: 401,
        headers: { "x-request-id": requestId },
      });
    }

    // thread_id from request body OR cookie
    const rawTid = String(body?.thread_id || jar.get("vs_tid")?.value || "").trim();
    const thread_id = UUID_RE.test(rawTid) ? rawTid : null;

    // vantage_id from request body OR cookie
    const rawVid = String(body?.vantage_id || jar.get("vs_vantage_id")?.value || "").trim();
    const vantage_id = rawVid ? rawVid.slice(0, 64) : null;

    // model from request body OR cookie (LabControlsPanel writes vs_model)
    const rawModel = String(body?.model || jar.get("vs_model")?.value || "").trim();

    // allowlist to avoid weird values
    const modelAllowed = new Set(["gpt-5.2", "gpt-5.1", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "xai:grok-3", "xai:grok-3-mini", "xai:grok-4-0709", "xai:grok-4-1-fast-non-reasoning", "xai:grok-4-1-fast-reasoning", "xai:grok-4-fast-non-reasoning", "xai:grok-4-fast-reasoning", "xai:grok-code-fast-1", "xai:grok-2-vision-1212", "xai:grok-2-image-1212"]);
    const model = modelAllowed.has(rawModel) ? rawModel : null;

    const modelRequested = model; // for response headers

    // limits from request body OR cookie
    let limits: any = sanitizeLimits(body?.limits);
    if (!limits) {
      const rawCookie = jar.get("vs_vantage_limits")?.value;
      if (rawCookie) {
        try {
          limits = sanitizeLimits(JSON.parse(decodeURIComponent(rawCookie)));
        } catch { }
      }
    }

    // routing from request body OR cookie
    let routing: any = sanitizeRouting(body?.routing);
    if (!routing) {
      const rawCookie = jar.get("vs_vantage_routing")?.value;
      if (rawCookie) {
        try {
          routing = sanitizeRouting(JSON.parse(decodeURIComponent(rawCookie)));
        } catch { }
      }
    }

    const extraTags: string[] = [];

    // mix controls from request body OR cookie
    let mix: any = sanitizeMix(body?.mix);
    if (!mix) {
      const rawCookie = jar.get("vs_vantage_mix")?.value;
      if (rawCookie) {
        try {
          mix = sanitizeMix(JSON.parse(decodeURIComponent(rawCookie)));
        } catch { }
      }
    }
    // if still missing, apply default mix so conversation/thread context works by default
    if (!mix) {
      mix = sanitizeMix({}); // uses defaults: conversation=0.70, etc.
    }

    // pragmatics from request body OR cookie
    let pragmatics: any = sanitizePragmatics((body as any)?.pragmatics);
    if (!pragmatics) {
      const rawCookie = jar.get("vs_vantage_pragmatics")?.value;
      if (rawCookie) {
        try {
          pragmatics = sanitizePragmatics(JSON.parse(decodeURIComponent(rawCookie)));
        } catch { }
      }
    }

    // Vantage definition overlay from request body OR cookie.
    // Back-compat: old field/cookie name was "roleplay".
    let roleplay: any =
      sanitizeRoleplay((body as any)?.definition_overlay) ||
      sanitizeRoleplay((body as any)?.roleplay);

    if (!roleplay) {
      const rawCookie =
        jar.get("vs_vantage_definition_overlay")?.value ||
        jar.get("vs_vantage_roleplay")?.value;
      if (rawCookie) {
        try {
          roleplay = sanitizeRoleplay(JSON.parse(decodeURIComponent(rawCookie)));
        } catch { }
      }
    }

    const permittedVantage = enforceVantagePermissions({ isAdmin, mix, routing, limits, pragmatics });
    mix = permittedVantage.mix;
    routing = permittedVantage.routing;
    limits = permittedVantage.limits;
    pragmatics = permittedVantage.pragmatics;

    // 1) Log user message (authoritative transcript)
    // (skip if noStore to avoid polluting memory with probes/tests)
    if (!noStore) {
      try {
        await fetch(`${BRAINS_URL}/log`, {
          method: "POST",
          headers: brainsHeaders(requestId, user_id),
          body: JSON.stringify({
            user_id,
            thread_id,
            ...(vantage_id ? { vantage_id } : {}),
            source: "frontend/chat:user",
            text: msg,
            tags: ["user", "chat", ...extraTags],
          }),
        });
      } catch { }
    }

    // DEBUG gate: only allow debug output if VS_DEBUG_TOKEN matches header or cookie
    const debugTokenHdr = req.headers.get("x-vs-debug-token") || "";
    const debugTokenCookie = jar.get("vs_debug_token")?.value || "";
    const debugTokenValid =
      !!process.env.VS_DEBUG_TOKEN &&
      (debugTokenHdr === process.env.VS_DEBUG_TOKEN ||
        debugTokenCookie === process.env.VS_DEBUG_TOKEN);

    // Inspector/debug output is admin-only. A stale browser debug cookie must not
    // grant Inspector access after switching to a non-admin account.
    const debugAllowed = isAdmin && debugTokenValid;

    const wantDebug = body?.debug === true && debugAllowed;

    const debugHdrPresent = req.headers.has("x-vs-debug-token") ? "1" : "0";
    const debugCookiePresent = jar.get("vs_debug_token")?.value ? "1" : "0";
    const debugFlags = {
      "X-VS-Debug-Hdr-Present": debugHdrPresent,
      "X-VS-Debug-Cookie-Present": debugCookiePresent,
      "X-VS-Debug-Allowed": debugAllowed ? "1" : "0",
      "X-VS-WantDebug": wantDebug ? "1" : "0",
    };

    // 2) Brains answer via /vantage/query
    const r = await fetch(`${BRAINS_URL}/vantage/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-request-id": requestId },
      body: JSON.stringify({
        user_id,
        message: msg,
        thread_id,
        top_k: Number(body?.top_k || 5) || 5,
        debug: wantDebug,
        ...(model ? { model } : {}),
        ...(vantage_id ? { vantage_id } : {}),
        ...(limits ? { limits } : {}),
        ...(routing ? { routing } : {}),
        ...(mix ? { mix } : {}),
        ...(pragmatics ? { pragmatics } : {}),
        ...(roleplay ? { definition_overlay: roleplay } : {}),
      }),
    });

    const rawBrains = await r.text();

    let reply = rawBrains;
    let modelUsed: string | null = null;
    let memoryUsedCount = 0;
    let corpusUsedCount = 0;

    try {
      const data = JSON.parse(rawBrains);

      reply =
        data?.answer ??
        data?.reply ??
        data?.content ??
        data?.text ??
        rawBrains;

      modelUsed = String(data?.meta_explanation?.model?.id || "").trim() || null;

      const counts = data?.meta_explanation?.vantage?.counts;
      if (counts && typeof counts === "object") {
        memoryUsedCount = Number(counts.k_memory ?? 0) || 0;
        corpusUsedCount = Number(counts.k_corpus ?? 0) || 0;
      } else if (Array.isArray(data?.memory_used)) {
        const mem = data.memory_used;
        memoryUsedCount = mem.filter((m: any) => m?.collection === "memory_raw").length;
        corpusUsedCount = mem.filter((m: any) => m?.collection && m.collection !== "memory_raw").length;
      }
    } catch {
      // leave reply/modelUsed/counts as defaults
    }

    // DEBUG PASSTHROUGH (gated): if wantDebug, return raw Brains JSON + debug headers
    if (wantDebug) {
      return new Response(rawBrains, {
        status: r.status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "x-request-id": requestId,
          ...(vantage_id ? { "X-VS-Vantage-Id": vantage_id } : {}),
          ...(modelRequested ? { "X-VS-Model-Requested": modelRequested } : {}),
          ...(modelUsed ? { "X-VS-Model-Used": modelUsed } : {}),
          ...(mix ? { "X-VS-Mix": encodeURIComponent(JSON.stringify(mix)).slice(0, 500) } : {}),
          "X-VS-Memory-Used": String(memoryUsedCount),
          "X-VS-Corpus-Used": String(corpusUsedCount),
          ...debugFlags,
        },
      });
    }

    if (!r.ok) {
      return new Response(`Brains HTTP ${r.status}\n${rawBrains.slice(0, 2000)}`, {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8", "x-request-id": requestId },
      });
    }

    // 3) Log assistant reply
    if (!noStore) {
      try {
        await fetch(`${BRAINS_URL}/log`, {
          method: "POST",
          headers: brainsHeaders(requestId, user_id),
          body: JSON.stringify({
            user_id,
            thread_id,
            ...(vantage_id ? { vantage_id } : {}),
            source: "frontend/chat:assistant",
            text: String(reply),
            tags: ["assistant", "chat", ...extraTags],
          }),
        });
      } catch { }
    }

    // 4) Stream plain text to assistant-ui transport
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(String(reply)));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-request-id": requestId,
        ...(vantage_id ? { "X-VS-Vantage-Id": vantage_id } : {}),
        ...(modelRequested ? { "X-VS-Model-Requested": modelRequested } : {}),
        ...(modelUsed ? { "X-VS-Model-Used": modelUsed } : {}),
        ...(mix ? { "X-VS-Mix": encodeURIComponent(JSON.stringify(mix)).slice(0, 500) } : {}),
        ...(memoryUsedCount > 0 ? { "X-VS-Memory-Used": String(memoryUsedCount) } : {}),
        ...(corpusUsedCount > 0 ? { "X-VS-Corpus-Used": String(corpusUsedCount) } : {}),
        "X-VS-Memory-Used": String(memoryUsedCount),
        "X-VS-Corpus-Used": String(corpusUsedCount),
        ...debugFlags,
      },
    });
  } catch (err: any) {
    return new Response(`Route error: ${err?.message || String(err)}`, {
      status: 500,
      headers: { "x-request-id": requestId },
    });
  }
}
