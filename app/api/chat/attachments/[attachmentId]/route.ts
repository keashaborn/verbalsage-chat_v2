export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import {
  getFreshSupabaseAuthContextFromRequest,
  getSupabaseBearerAuthorizationFromRequest,
} from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  req: Request,
  context: { params: Promise<{ attachmentId: string }> },
) {
  const rid = String(req.headers.get("x-request-id") || "").trim() || randomUUID();
  const auth = await getFreshSupabaseAuthContextFromRequest(req);
  const authorization = getSupabaseBearerAuthorizationFromRequest(req);
  if (!auth || !authorization || !UUID_RE.test(auth.user_id)) {
    return new Response("unauthorized", {
      status: 401,
      headers: { "x-request-id": rid },
    });
  }
  const { attachmentId } = await context.params;
  if (!UUID_RE.test(attachmentId)) {
    return new Response("invalid attachment id", {
      status: 400,
      headers: { "x-request-id": rid },
    });
  }
  const brains = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const upstream = await fetch(
    `${brains}/attachments/${encodeURIComponent(attachmentId)}?user_id=${encodeURIComponent(auth.user_id)}`,
    {
      method: "DELETE",
      headers: brainsUpstreamHeaders(rid, auth.user_id, { authorization }),
      cache: "no-store",
    },
  );
  const body = await upstream.text().catch(() => "");
  return new Response(body || "Attachment service unavailable", {
    status: upstream.status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "x-request-id": upstream.headers.get("x-request-id") || rid,
    },
  });
}
