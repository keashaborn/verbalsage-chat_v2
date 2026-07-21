export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { getSupabaseAuthContextFromRequest } from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

function lastUserText(messages: any[]): string {
  const item = [...messages].reverse().find((message) => message?.role === "user");
  if (!item) return "";
  if (typeof item.content === "string") return item.content;
  const parts = Array.isArray(item.parts) ? item.parts : Array.isArray(item.content) ? item.content : [];
  return parts.map((part: any) => String(part?.text || "")).join("");
}

function shouldAvoidStorage(body: any, message: string): boolean {
  const normalized = message.trim().toLowerCase();
  const testPrefixes = [
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
  return body?.noStore === true || body?.debug === true || testPrefixes.some((prefix) => normalized.startsWith(prefix));
}

export async function POST(req: Request) {
  const rid = requestId(req);
  try {
    const body = await req.json().catch(() => ({}));
    const message =
      (typeof body?.input === "string" && body.input) ||
      (typeof body?.message === "string" && body.message) ||
      (Array.isArray(body?.messages) ? lastUserText(body.messages) : "") ||
      "";
    if (!message.trim()) {
      return new Response("Missing user message", { status: 400, headers: { "x-request-id": rid } });
    }

    const auth = await getSupabaseAuthContextFromRequest(req);
    const allowGuest = process.env.VS_DEV_ALLOW_GUEST === "1";
    const devUser = String(process.env.VS_DEV_TEST_USER_ID || "").trim();
    const userId = auth?.user_id || (allowGuest ? devUser : "");
    if (!userId || !UUID_RE.test(userId)) {
      return new Response("unauthorized", { status: 401, headers: { "x-request-id": rid } });
    }

    const rawThread = String(body?.thread_id || "").trim();
    const threadId = UUID_RE.test(rawThread) ? rawThread : null;
    const noStore = shouldAvoidStorage(body, message);
    if (!noStore && !threadId) {
      return new Response("thread_id required", { status: 400, headers: { "x-request-id": rid } });
    }

    const brains = process.env.BRAINS_URL || "http://172.31.32.171:8088";
    if (!noStore) {
      const log = await fetch(`${brains}/log`, {
        method: "POST",
        headers: brainsUpstreamHeaders(rid, userId, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          user_id: userId,
          thread_id: threadId,
          source: "frontend/chat:user",
          text: message,
          tags: ["user", "chat"],
        }),
        cache: "no-store",
      });
      if (!log.ok) {
        return new Response("Transcript write unavailable", { status: 503, headers: { "x-request-id": rid } });
      }
    }

    const upstream = await fetch(`${brains}/response/query`, {
      method: "POST",
      headers: brainsUpstreamHeaders(rid, userId, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        user_id: userId,
        message,
        thread_id: threadId,
        no_store: noStore,
      }),
      cache: "no-store",
    });
    const raw = await upstream.text().catch(() => "");
    if (!upstream.ok) {
      return new Response(`Brains HTTP ${upstream.status}\n${raw.slice(0, 1000)}`, {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8", "x-request-id": rid },
      });
    }

    let answer = raw;
    let answerId = "";
    try {
      const parsed = JSON.parse(raw);
      answer = String(parsed?.answer || "");
      answerId = String(parsed?.answer_id || "");
    } catch {}
    if (!answer) {
      return new Response("Empty response", { status: 502, headers: { "x-request-id": rid } });
    }

    return new Response(answer, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-request-id": rid,
        "X-VS-Response-Runtime": "resse_response_v0_2",
        ...(answerId ? { "X-VS-Answer-Id": answerId } : {}),
      },
    });
  } catch (error: any) {
    return new Response(`Route error: ${error?.message || String(error)}`, {
      status: 500,
      headers: { "x-request-id": rid },
    });
  }
}
