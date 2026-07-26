export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

const SCOPE = "user_global";
const MARKER = "RESSE_USER_PREFERENCES_V1\n";

type Preferences = {
  nickname: string;
  occupation: string;
  more_about_you: string;
  custom_instructions: string;
  response_length: "concise" | "balanced" | "detailed";
  technical_depth: "plain" | "balanced" | "expert";
  format: "auto" | "prose" | "bullets" | "steps";
  conversation_style: "direct" | "natural" | "warm";
  encouragement: "neutral";
};

const DEFAULTS: Preferences = {
  nickname: "",
  occupation: "",
  more_about_you: "",
  custom_instructions: "",
  response_length: "balanced",
  technical_depth: "balanced",
  format: "auto",
  conversation_style: "natural",
  encouragement: "neutral",
};

function clean(value: unknown, max: number): string {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  const normalized = String(value || "").trim() as T;
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalize(raw: any): Preferences {
  return {
    nickname: clean(raw?.nickname, 64),
    occupation: clean(raw?.occupation, 160),
    more_about_you: clean(raw?.more_about_you, 2000),
    custom_instructions: clean(raw?.custom_instructions, 1200),
    response_length: enumValue(
      raw?.response_length,
      ["concise", "balanced", "detailed"] as const,
      "balanced",
    ),
    technical_depth: enumValue(
      raw?.technical_depth,
      ["plain", "balanced", "expert"] as const,
      "balanced",
    ),
    format: enumValue(
      raw?.format,
      ["auto", "prose", "bullets", "steps"] as const,
      "auto",
    ),
    conversation_style: enumValue(
      raw?.conversation_style,
      ["direct", "natural", "warm"] as const,
      "natural",
    ),
    encouragement: "neutral",
  };
}

function parseCard(text: string): Preferences {
  if (!text.startsWith(MARKER)) return DEFAULTS;
  try {
    return normalize(JSON.parse(text.slice(MARKER.length)));
  } catch {
    return DEFAULTS;
  }
}

async function userId(req: Request): Promise<string | null> {
  const real = await getSupabaseUserIdFromRequest(req);
  if (real) return real;
  if (process.env.VS_DEV_ALLOW_GUEST === "1") {
    return String(process.env.VS_DEV_TEST_USER_ID || "").trim() || null;
  }
  return null;
}

function rid(req: Request): string {
  const raw = (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    ""
  ).trim();
  return (raw || crypto.randomUUID()).slice(0, 128);
}

export async function GET(req: Request) {
  const requestId = rid(req);
  const owner = await userId(req);
  if (!owner)
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  const brains = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const upstream = await fetch(
    `${brains}/cards/${encodeURIComponent(owner)}?vantage_id=${SCOPE}&kinds=user_instructions&limit=1`,
    {
      method: "GET",
      headers: brainsUpstreamHeaders(requestId, owner),
      cache: "no-store",
    },
  );
  const raw = await upstream.text().catch(() => "");
  if (!upstream.ok)
    return NextResponse.json(
      { error: "preferences_unavailable" },
      { status: 502, headers: { "x-request-id": requestId } },
    );

  let preferences = DEFAULTS;
  let updated_at: string | null = null;
  try {
    const parsed = JSON.parse(raw);
    const card = Array.isArray(parsed?.items) ? parsed.items[0] : null;
    preferences = parseCard(String(card?.text || ""));
    updated_at = card?.updated_at || card?.created_at || null;
  } catch {}
  return NextResponse.json(
    { ok: true, ...preferences, updated_at },
    { headers: { "x-request-id": requestId } },
  );
}

export async function POST(req: Request) {
  const requestId = rid(req);
  const owner = await userId(req);
  if (!owner)
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  const preferences = normalize(await req.json().catch(() => ({})));
  const text = MARKER + JSON.stringify(preferences);
  const brains = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const upstream = await fetch(
    `${brains}/cards/${encodeURIComponent(owner)}?vantage_id=${SCOPE}`,
    {
      method: "POST",
      headers: brainsUpstreamHeaders(requestId, owner, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        kind: "user_instructions",
        topic_key: "__singleton__",
        tags: ["card", "user_instructions", "resse_preferences_v1"],
        base_importance: 0.9,
        text,
      }),
      cache: "no-store",
    },
  );
  if (!upstream.ok)
    return NextResponse.json(
      { error: "preferences_save_failed" },
      { status: 502, headers: { "x-request-id": requestId } },
    );
  return NextResponse.json(
    { ok: true, ...preferences },
    { headers: { "x-request-id": requestId } },
  );
}
