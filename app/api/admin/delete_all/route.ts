export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAdmin } from "../_auth";
import { cookieSecure } from "@/lib/cookieSecure";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";


function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}


export async function DELETE(req: Request) {
  const requestId = getRequestId(req);

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.msg },
      { status: auth.status, headers: { "x-request-id": requestId } }
    );
  }

  if (process.env.VS_ALLOW_DELETE_ALL !== "true") {
    return NextResponse.json({ error: "delete_all disabled" }, { status: 403, headers: { "x-request-id": requestId } });
  }

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const user_id = await getSupabaseUserIdFromRequest(req);
  if (!user_id) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });

  const r = await fetch(`${BRAINS}/user/${encodeURIComponent(user_id)}/data`, {
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

  // Clear active thread cookie so UI doesn't point at deleted data
  const res = new NextResponse(txt, {
    status: 200,
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
  });

  const secure = await cookieSecure();
  res.cookies.set("vs_tid", "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
