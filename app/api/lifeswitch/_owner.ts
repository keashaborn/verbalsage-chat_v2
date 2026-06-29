import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";

export async function getLifeSwitchOwnerUserId(req: Request): Promise<string | null> {
  return await getSupabaseUserIdFromRequest(req);
}

export function unauthorizedLifeSwitch(requestId: string): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": requestId,
    },
  });
}

export function injectOwnerUserId(upstream: URL, owner_user_id: string): void {
  upstream.searchParams.set("owner_user_id", owner_user_id);
}

export function lifeSwitchUpstreamHeaders(
  requestId: string,
  owner_user_id?: string | null,
  extra?: HeadersInit,
): HeadersInit {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-request-id": requestId,
  };

  const serviceToken = (process.env.VS_SERVICE_TOKEN || "").trim();
  if (serviceToken) headers["x-vs-service-token"] = serviceToken;

  const actor = String(owner_user_id || "").trim();
  if (actor) headers["x-vs-actor-user-id"] = actor;

  if (extra) {
    const incoming = new Headers(extra);
    incoming.forEach((value, key) => {
      headers[key] = value;
    });
  }

  return headers;
}
