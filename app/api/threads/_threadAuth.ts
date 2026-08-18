import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  getSupabaseBearerAuthorizationFromRequest,
  getSupabaseUserIdFromRequest,
} from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

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

export function threadUpstreamHeaders(
  req: Request,
  requestId: string,
  userId: string,
  extra?: HeadersInit,
): HeadersInit {
  const authorization = getSupabaseBearerAuthorizationFromRequest(req);
  if (!authorization) {
    throw new Error("missing verified thread authorization");
  }
  const headers = new Headers(extra);
  headers.set("authorization", authorization);
  return brainsUpstreamHeaders(requestId, userId, headers);
}

export async function threadBelongsToUser(
  req: Request,
  thread_id: string,
  user_id: string,
  requestId: string,
): Promise<boolean> {
  const tid = String(thread_id || "").trim();
  if (!UUID_RE.test(tid)) return false;

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";

  const r = await fetch(`${BRAINS}/threads/list/${encodeURIComponent(user_id)}`, {
    method: "GET",
    headers: threadUpstreamHeaders(req, requestId, user_id, {
      Accept: "application/json",
    }),
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
