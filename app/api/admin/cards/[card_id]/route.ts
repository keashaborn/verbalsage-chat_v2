import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { requireAdmin } from "../../_auth";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}

const PROTECTED_KINDS = new Set([
  "gravity_profile",
  "vb_desire_profile",
  "user_identity",
  "assistant_identity",
  "style_mode",
  "style",
]);

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

export async function DELETE(req: NextRequest, context: { params: Promise<{ card_id: string }> }) {
  const requestId = getRequestId(req);

  const auth = await requireAdmin();
  if (!auth.ok) {
    return new Response(auth.msg, { status: auth.status, headers: { "x-request-id": requestId } });
  }

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const user_id = (await getUserIdFromCookie()) || null;
  if (!user_id) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });

  const { card_id } = await context.params;

  // 1) Fetch card metadata to enforce protected kinds
  try {
    const meta = await fetch(`${BRAINS}/cards/${encodeURIComponent(user_id)}/${encodeURIComponent(card_id)}`, {
      method: "GET",
      headers: { Accept: "application/json", "x-request-id": requestId },
      cache: "no-store",
    });

    if (meta.ok) {
      const j: any = await meta.json().catch(() => null);
      const kind = String(j?.kind || "");
      if (PROTECTED_KINDS.has(kind)) {
        return NextResponse.json({ error: "protected_card", kind }, { status: 403, headers: { "x-request-id": requestId } });
      }
    }
    // If meta fails (404/500), fall through and attempt delete
  } catch {
    // ignore meta errors
  }

  // 2) Perform delete
  const r = await fetch(`${BRAINS}/cards/${encodeURIComponent(user_id)}/${encodeURIComponent(card_id)}`, {
    method: "DELETE",
    headers: { "x-request-id": requestId },
    cache: "no-store",
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    return NextResponse.json(
      { error: `brains HTTP ${r.status}`, details: txt },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }

  return new NextResponse(txt, {
    status: 200,
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
  });
}
