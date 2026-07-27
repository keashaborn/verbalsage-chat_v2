export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";


function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}


export async function GET(req: Request) {
  const requestId = getRequestId(req);

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const user_id = await getSupabaseUserIdFromRequest(req);
  if (!user_id) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });

  const r = await fetch(`${BRAINS}/threads/list/${encodeURIComponent(user_id)}`, {
    method: "GET",
    headers: brainsUpstreamHeaders(requestId, user_id, { Accept: "application/json" }),
    cache: "no-store",
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    return NextResponse.json(
      { error: `brains HTTP ${r.status}`, details: txt },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }

  let rows: any[] = [];
  try {
    const parsed = JSON.parse(txt);
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    rows = [];
  }

  const normalized = rows.map((t: any) => ({
    ...t,
    thread_id: String(t?.thread_id || t?.id || "").trim(),
  })).filter((t: any) => t.thread_id);

  return NextResponse.json(normalized, {
    status: 200,
    headers: { "x-request-id": requestId },
  });
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const user_id = await getSupabaseUserIdFromRequest(req);
  if (!user_id) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "New chat").trim() || "New chat";

  const r = await fetch(`${BRAINS}/threads/new`, {
    method: "POST",
    headers: brainsUpstreamHeaders(requestId, user_id, { "Content-Type": "application/json" }),
    body: JSON.stringify({ user_id, title }),
    cache: "no-store",
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    return NextResponse.json(
      { error: `brains HTTP ${r.status}`, details: txt },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }

  let data: any = {};
  try {
    data = JSON.parse(txt);
  } catch { }

  const thread_id = String(data?.thread_id || data?.id || "").trim();
  if (thread_id) data.thread_id = thread_id;

  return NextResponse.json(data, {
    status: 200,
    headers: { "x-request-id": requestId },
  });
}
