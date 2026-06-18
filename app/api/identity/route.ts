export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";


function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  return raw || crypto.randomUUID();
}


export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";

  const user_id = await getSupabaseUserIdFromRequest(req);
  if (!user_id) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: { "x-request-id": requestId } }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const full_name = String(body?.full_name || "").trim();
  const email = String(body?.email || "").trim();
  const name = full_name || email;
  if (!name) {
    return Response.json(
      { error: "missing name" },
      { status: 400, headers: { "x-request-id": requestId } }
    );
  }

  // idempotent: if already exists, do nothing
  const existing = await fetch(
    `${BRAINS_URL}/cards/${encodeURIComponent(user_id)}?kinds=user_identity&limit=1`,
    {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json", "x-request-id": requestId },
    }
  );

  if (existing.ok) {
    const j: any = await existing.json().catch(() => null);
    if (j?.count && j.count > 0) {
      return Response.json({ status: "exists" }, { headers: { "x-request-id": requestId } });
    }
  }

  const r = await fetch(`${BRAINS_URL}/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({
      user_id,
      source: "frontend/identity",
      text: `FULL_NAME:${name}`,
      tags: ["identity"],
    }),
  });

  const t = await r.text().catch(() => "");
  if (!r.ok) {
    return new Response(t || "brains error", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "x-request-id": requestId },
    });
  }

  return Response.json({ status: "ok" }, { headers: { "x-request-id": requestId } });
}
