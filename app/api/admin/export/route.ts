import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import { getSupabaseBearerAuthorizationFromRequest } from "@/app/api/_auth/supabaseUser";
import { randomUUID } from "crypto";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRequestId(req: Request): string {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}

function responseHeaders(requestId: string): Record<string, string> {
  return {
    "cache-control": "private, no-store, max-age=0, must-revalidate",
    pragma: "no-cache",
    expires: "0",
    "x-content-type-options": "nosniff",
    "x-request-id": requestId,
  };
}

function safeUpstreamStatus(status: number): number {
  return [400, 401, 403, 413, 503].includes(status) ? status : 502;
}

function upstreamError(status: number): string {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 413) return "conversation_export_too_large";
  if (status === 503) return "conversation_export_unavailable";
  if (status === 400) return "conversation_export_invalid_request";
  return "conversation_export_upstream_error";
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  const auth = await requireFreshCapability(req, "user_data.export");
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.msg }), {
      status: auth.status,
      headers: {
        ...responseHeaders(requestId),
        "content-type": "application/json",
      },
    });
  }

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const user_id = String((auth as any).payload?.sub || "");
  const authorization = getSupabaseBearerAuthorizationFromRequest(req);

  if (!user_id || !authorization) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: {
        ...responseHeaders(requestId),
        "content-type": "application/json",
      },
    });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BRAINS}/conversation/export`, {
      method: "GET",
      headers: brainsUpstreamHeaders(requestId, user_id, { authorization }),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "conversation_export_unavailable" }),
      {
        status: 503,
        headers: {
          ...responseHeaders(requestId),
          "content-type": "application/json",
        },
      },
    );
  }

  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: upstreamError(upstream.status) }), {
      status: safeUpstreamStatus(upstream.status),
      headers: {
        ...responseHeaders(requestId),
        "content-type": "application/json",
      },
    });
  }

  const headers = new Headers(responseHeaders(requestId));
  headers.set(
    "content-type",
    upstream.headers.get("content-type") || "application/json",
  );
  for (const name of ["content-disposition", "x-content-sha256"] as const) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, { status: 200, headers });
}
