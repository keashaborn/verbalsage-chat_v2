import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";
import { cookieSecure } from "@/lib/cookieSecure";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}

export async function getThreadUserId(req: Request): Promise<string | null> {
  return await getSupabaseUserIdFromRequest(req);
}

export async function threadBelongsToUser(thread_id: string, user_id: string, requestId: string): Promise<boolean> {
  const tid = String(thread_id || "").trim();
  if (!UUID_RE.test(tid)) return false;

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";

  const r = await fetch(`${BRAINS}/threads/list/${encodeURIComponent(user_id)}`, {
    method: "GET",
    headers: { "x-request-id": requestId, Accept: "application/json" },
    cache: "no-store",
  });

  if (!r.ok) return false;

  const rows: any = await r.json().catch(() => []);
  if (!Array.isArray(rows)) return false;

  return rows.some((x) => {
    const id = String(x?.thread_id || x?.id || "").trim();
    return id === tid;
  });
}

export function unauthorized(requestId: string) {
  return NextResponse.json(
    { error: "unauthorized" },
    { status: 401, headers: { "x-request-id": requestId } }
  );
}

export function forbiddenThread(requestId: string) {
  return NextResponse.json(
    { error: "thread_not_found_for_user" },
    { status: 404, headers: { "x-request-id": requestId } }
  );
}

export async function clearActiveThreadResponse(payload: any = { thread_id: null }) {
  const res = NextResponse.json(payload);
  res.cookies.set("vs_tid", "", {
    httpOnly: true,
    secure: await cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function setActiveThreadResponse(thread_id: string) {
  const res = NextResponse.json({ ok: true, thread_id });
  res.cookies.set("vs_tid", thread_id, {
    httpOnly: true,
    secure: await cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
