export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import {
  forbiddenThread,
  getRequestId,
  getThreadUserId,
  threadBelongsToUser,
  unauthorized,
  UUID_RE,
} from "@/app/api/threads/_threadAuth";


function cleanTitle(s: string) {
  return String(s || "")
    .replace(/["“”'‘’]/g, "")
    .replace(/[.?!:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function fallbackTitle(input: string) {
  const stop = new Set([
    "the","a","an","and","or","but","if","then","with","about","what","when",
    "where","why","can","could","would","should","please","help","me","you",
    "i","im","i'm","to","of","for","on","is","are","was","were","be","been",
    "being","this","that","these","those","it","its","just","kind","sort",
    "thing","stuff","chat","talk"
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

async function generateTitle(input: string) {
  return fallbackTitle(input);
}

export async function POST(req: NextRequest, context: { params: Promise<{ thread_id: string }> }) {
  const requestId = getRequestId(req);

  const user_id = await getThreadUserId(req);
  if (!user_id) return unauthorized(requestId);

  const { thread_id } = await context.params;
  const tid = String(thread_id || "").trim();
  if (!UUID_RE.test(tid)) {
    return NextResponse.json(
      { error: "invalid thread_id" },
      { status: 400, headers: { "x-request-id": requestId } }
    );
  }

  const ownsThread = await threadBelongsToUser(tid, user_id, requestId);
  if (!ownsThread) return forbiddenThread(requestId);

  const body = await req.json().catch(() => ({}));
  const input = String(body?.input || body?.text || "").trim();

  if (input.length < 3) {
    return NextResponse.json(
      { ok: true, skipped: "too_short" },
      { status: 200 }
    );
  }

  const title = cleanTitle(await generateTitle(input)) || fallbackTitle(input);

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";

  const r = await fetch(`${BRAINS}/threads/${encodeURIComponent(tid)}/rename`, {
    method: "POST",
    headers: brainsUpstreamHeaders(requestId, user_id, { "Content-Type": "application/json" }),
    body: JSON.stringify({ title, title_source: "automatic" }),
  });

  const result = await r.json().catch(() => ({}));

  if (!r.ok) {
    return NextResponse.json(
      { error: `brains HTTP ${r.status}` },
      { status: 502 }
    );
  }


  return NextResponse.json({
    ok: true,
    thread_id: tid,
    title: String(result?.title || title),
    title_source: String(result?.title_source || "automatic"),
    updated: result?.updated !== false,
    skipped: result?.skipped || null,
  });
}
