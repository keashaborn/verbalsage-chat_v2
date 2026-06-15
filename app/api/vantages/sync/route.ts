export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  return raw || crypto.randomUUID();
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

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";

  const user_id = await getUserIdFromCookie();
  if (!user_id) {
    return Response.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "x-request-id": requestId } }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const mode =
    typeof body?.mode === "string" && ["full", "active"].includes(body.mode)
      ? body.mode
      : "full";

  const payload = {
    user_id,
    mode,
    defaultId: typeof body?.defaultId === "string" ? body.defaultId : "",
    source_updated_at: typeof body?.source_updated_at === "string" ? body.source_updated_at : null,
    active: body?.active && typeof body.active === "object" ? body.active : null,
    profiles: Array.isArray(body?.profiles) ? body.profiles : [],
  };

  const upstream = await fetch(`${BRAINS_URL}/vantages/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify(payload),
  });

  const txt = await upstream.text().catch(() => "");
  const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";

  return new Response(txt, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "x-request-id": upstream.headers.get("x-request-id") || requestId,
    },
  });
}
