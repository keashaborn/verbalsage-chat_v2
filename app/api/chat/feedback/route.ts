export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";


const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}


export async function POST(req: Request) {
  const requestId = getRequestId(req);

  try {
    const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";

    const jar = await cookies();
    const authedUserId = await getSupabaseUserIdFromRequest(req);

    const allowGuest = process.env.VS_DEV_ALLOW_GUEST === "1";
    const devTestUser = (process.env.VS_DEV_TEST_USER_ID || "").trim();

    let user_id: string;
    if (authedUserId) user_id = authedUserId;
    else if (allowGuest && devTestUser) user_id = devTestUser;
    else {
      return new Response("unauthorized", {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8", "x-request-id": requestId },
      });
    }

    let body: any = {};
    try { body = await req.json(); } catch { }

    const message = String(body?.message || "").trim();
    if (!message) {
      return new Response("Missing feedback message", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8", "x-request-id": requestId },
      });
    }

    // thread_id from body OR cookie
    const rawTid = String(body?.thread_id || jar.get("vs_tid")?.value || "").trim();
    const thread_id = UUID_RE.test(rawTid) ? rawTid : null;

    // vantage_id from body OR cookie
    const rawVid = String(body?.vantage_id || jar.get("vs_vantage_id")?.value || "").trim();
    const vantage_id = rawVid ? rawVid.slice(0, 64) : null;

    const r = await fetch(`${BRAINS_URL}/vantage/feedback`, {
      method: "POST",
      headers: brainsUpstreamHeaders(requestId, user_id, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        user_id,
        thread_id,
        message,
        ...(vantage_id ? { vantage_id } : {}),
      }),
      cache: "no-store",
    });

    const t = await r.text().catch(() => "");
    if (!r.ok) {
      return new Response(t || "brains error", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8", "x-request-id": requestId },
      });
    }

    return new Response(t, {
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
