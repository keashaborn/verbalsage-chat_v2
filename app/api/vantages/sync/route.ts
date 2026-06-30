export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";


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
    headers: brainsUpstreamHeaders(requestId, user_id, { "Content-Type": "application/json" }),
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
