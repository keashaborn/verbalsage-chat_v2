export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { randomUUID } from "crypto";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}

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

function cleanTitle(s: string): string {
  return String(s || "")
    .replace(/["“”'‘’]/g, "")
    .replace(/[.?!:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function fallbackTitle(input: string): string {
  const stop = new Set([
    "the","a","an","and","or","but","if","then","with","about","what","when","where","why","how",
    "can","could","would","should","please","help","me","you","i","im","i'm","to","of","for","in",
    "on","is","are","was","were","be","been","being","this","that","these","those","it","its","my",
    "just","kind","sort","thing","stuff","chat","talk"
  ]);

  const words = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !stop.has(w))
    .slice(0, 5);

  if (!words.length) return "New Topic";

  return words
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function generateTitle(input: string): Promise<string> {
  const fallback = fallbackTitle(input);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const model = process.env.OPENAI_TITLE_MODEL || "gpt-4o-mini";

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 16,
        messages: [
          {
            role: "system",
            content:
              "Create a concise chat title. Use 2 to 5 words. No quotes. No punctuation unless necessary. Do not start with 'Chat about'.",
          },
          {
            role: "user",
            content: input.slice(0, 1200),
          },
        ],
      }),
    });

    if (!r.ok) return fallback;
    const data: any = await r.json().catch(() => null);
    const title = cleanTitle(data?.choices?.[0]?.message?.content || "");
    return title || fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ thread_id: string }> }) {
  const requestId = getRequestId(req);

  const user_id = await getUserIdFromCookie();
  if (!user_id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });
  }

  const { thread_id } = await context.params;
  const tid = String(thread_id || "").trim();

  if (!UUID_RE.test(tid)) {
    return NextResponse.json({ error: "invalid thread_id" }, { status: 400, headers: { "x-request-id": requestId } });
  }

  const body = await req.json().catch(() => ({}));
  const input = String(body?.input || "").trim();

  if (input.length < 3) {
    return NextResponse.json({ ok: false, skipped: "input_too_short" }, { status: 200, headers: { "x-request-id": requestId } });
  }

  const title = cleanTitle(await generateTitle(input)) || fallbackTitle(input);

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const r = await fetch(`${BRAINS}/threads/${encodeURIComponent(tid)}/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({ title }),
    cache: "no-store",
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    return NextResponse.json(
      { error: `brains HTTP ${r.status}`, details: txt, fallback_title: title },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }

  return NextResponse.json({ ok: true, thread_id: tid, title }, { status: 200, headers: { "x-request-id": requestId } });
}
