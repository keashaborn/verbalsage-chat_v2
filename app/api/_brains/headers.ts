export function brainsUpstreamHeaders(
  requestId: string,
  actorUserId?: string | null,
  extra?: HeadersInit,
): HeadersInit {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-request-id": requestId,
  };

  const serviceToken = (process.env.VS_SERVICE_TOKEN || "").trim();
  if (serviceToken) headers["x-vs-service-token"] = serviceToken;

  const actor = String(actorUserId || "").trim();
  if (actor) headers["x-vs-actor-user-id"] = actor;

  if (extra) {
    const incoming = new Headers(extra);
    incoming.forEach((value, key) => {
      headers[key] = value;
    });
  }

  return headers;
}
