import { randomUUID } from "crypto";
import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const user_id = await getSupabaseUserIdFromRequest(req);

  if (!user_id) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "x-request-id": requestId },
    });
  }

  const url = new URL(req.url);
  const limit = String(url.searchParams.get("limit") || "20000");

  const upstream = await fetch(
    `${BRAINS}/user/${encodeURIComponent(user_id)}/export?limit=${encodeURIComponent(limit)}`,
    {
      method: "GET",
      headers: { "x-request-id": requestId },
      cache: "no-store",
    }
  );

  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    return new Response(txt || `Brains HTTP ${upstream.status}`, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "x-request-id": requestId },
    });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") || "application/json");
  headers.set("x-request-id", requestId);

  const cd = upstream.headers.get("content-disposition");
  if (cd) headers.set("Content-Disposition", cd);

  return new Response(upstream.body, { status: 200, headers });
}
