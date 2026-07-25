export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { requireCapability } from "@/app/api/_auth/requireCapability";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import {
  inspectorSessionCookieName,
  inspectorSessionEnabled,
} from "@/lib/inspectorSession";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
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

  // Legacy diagnostic defaults. Ordinary chat does not read these controls.
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

  // Legacy diagnostic defaults. Ordinary chat does not read these controls.
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
    const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";
    const jar = await cookies();

    const cap = await requireCapability(req, "inspector.view");

    if (!cap.ok) {
      return new Response(cap.msg, {
        status: cap.status,
        headers: { "Content-Type": "text/plain; charset=utf-8", "x-request-id": requestId },
      });
    }

    const inspectorEnabled = inspectorSessionEnabled(
      jar.get(inspectorSessionCookieName())?.value,
    );
    if (!inspectorEnabled) {
      return new Response("inspector session required", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8", "x-request-id": requestId },
      });
    }

    // Primary: Supabase user_id from Authorization header
    const user_id = String((cap as any).payload?.sub || "");
    const isAdmin = (cap as any).role === "owner" || (cap as any).role === "admin";

    let body: any = {};
    try {
      body = await req.json();
    } catch { }

    const msg = String(body?.message || body?.input || "").trim();
    if (!msg) {
      return new Response("Missing message", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8", "x-request-id": requestId },
      });
    }

    const rawTid = String(body?.thread_id || jar.get("vs_tid")?.value || "").trim();
    const thread_id = UUID_RE.test(rawTid) ? rawTid : null;

    const rawVid = String(body?.vantage_id || jar.get("vs_vantage_id")?.value || "").trim();
    const vantage_id = rawVid ? rawVid.slice(0, 64) : "default";

    const rawModel = String(body?.model || jar.get("vs_model")?.value || "").trim();
    const modelAllowed = new Set([
        "gpt-5.2", "gpt-5.1", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini",
      ]);
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

    // Call Brains with inspect_only + debug
    const r = await fetch(`${BRAINS_URL}/vantage/query`, {
      method: "POST",
      headers: brainsUpstreamHeaders(requestId, user_id, { "Content-Type": "application/json" }),
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
      cache: "no-store",
    });

    const raw = await r.text();
    return new Response(raw, {
      status: r.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "x-request-id": requestId,
      },
    });
  } catch (err: any) {
    return new Response(`Route error: ${err?.message || String(err)}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "x-request-id": requestId },
    });
  }
}
