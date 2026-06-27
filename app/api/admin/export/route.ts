import { requireCapability } from "@/app/api/_auth/requireCapability";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  const auth = await requireCapability(req, "user_data.export");
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.msg }), {
      status: auth.status,
      headers: { "Content-Type": "application/json", "x-request-id": requestId },
    });
  }

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const user_id = String((auth as any).payload?.sub || "");

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
