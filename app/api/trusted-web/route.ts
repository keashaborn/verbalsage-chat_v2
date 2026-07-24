export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import { isAbortLike, requestDeadlineSignal } from "@/lib/requestDeadline";

const TRUSTED_WEB_TIMEOUT_MS = 55_000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_SOURCE_DOMAINS = new Set([
  "ods.od.nih.gov",
  "medlineplus.gov",
  "dietaryguidelines.gov",
  "realfood.gov",
  "odphp.health.gov",
  "fda.gov",
  "pubmed.ncbi.nlm.nih.gov",
  "pmc.ncbi.nlm.nih.gov",
  "bacb.com",
]);
const RESPONSE_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
};

function requestId(req: Request): string {
  const raw = (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    ""
  ).trim();
  return raw && raw.length <= 128 ? raw : randomUUID();
}

function parseQuery(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (
    Object.keys(record).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(record, "query") ||
    typeof record.query !== "string"
  ) {
    return null;
  }
  const query = record.query.replace(/\s+/g, " ").trim();
  if (query.length < 4 || query.length > 2_000) return null;
  if (
    [...record.query].some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 && code !== 9 && code !== 10 && code !== 13;
    })
  ) {
    return null;
  }
  return query;
}

function sourceUrlAllowed(raw: unknown): boolean {
  if (typeof raw !== "string" || raw.length < 1 || raw.length > 4_096) {
    return false;
  }
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.port
    ) {
      return false;
    }
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (!host || /^\d+(?:\.\d+){3}$/.test(host) || host.includes(":")) {
      return false;
    }
    return [...ALLOWED_SOURCE_DOMAINS].some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

function boundedRetryAfter(value: string | null): string {
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 1 && seconds <= 300
    ? String(seconds)
    : "60";
}

export async function POST(req: Request) {
  const rid = requestId(req);
  try {
    const query = parseQuery(await req.json().catch(() => null));
    if (!query) {
      return new Response("Invalid trusted web request", {
        status: 400,
        headers: { ...RESPONSE_HEADERS, "x-request-id": rid },
      });
    }

    const capability = await requireFreshCapability(req, "web_search.use");
    const capabilityAuth = capability.auth;
    if (!capability.ok || !capabilityAuth) {
      return new Response(
        capability.status === 403 ? "capability required" : "unauthorized",
        {
          status: capability.status,
          headers: { ...RESPONSE_HEADERS, "x-request-id": rid },
        },
      );
    }

    const userId = capabilityAuth.user_id;
    if (!UUID_RE.test(userId)) {
      return new Response("unauthorized", {
        status: 401,
        headers: { ...RESPONSE_HEADERS, "x-request-id": rid },
      });
    }

    const brains = process.env.BRAINS_URL || "http://172.31.32.171:8088";
    const upstream = await fetch(`${brains}/trusted-web/query`, {
      method: "POST",
      headers: brainsUpstreamHeaders(rid, userId),
      body: JSON.stringify({ user_id: userId, query }),
      cache: "no-store",
      signal: requestDeadlineSignal(TRUSTED_WEB_TIMEOUT_MS, req.signal),
    });
    const raw = await upstream.text().catch(() => "");
    if (raw.length > 65_536) {
      return new Response("Trusted web response unavailable", {
        status: 502,
        headers: { ...RESPONSE_HEADERS, "x-request-id": rid },
      });
    }
    if (!upstream.ok) {
      const status =
        upstream.status === 429
          ? 429
          : upstream.status === 503
            ? 503
            : upstream.status === 504
              ? 504
              : 502;
      return new Response(
        status === 429
          ? "Trusted web rate limit reached"
          : status === 504
            ? "Trusted web search timed out"
            : "Trusted web search unavailable",
        {
          status,
          headers: {
            ...RESPONSE_HEADERS,
            "x-request-id": rid,
            ...(status === 429
              ? {
                  "Retry-After": boundedRetryAfter(
                    upstream.headers.get("retry-after"),
                  ),
                }
              : {}),
          },
        },
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return new Response("Trusted web response unavailable", {
        status: 502,
        headers: { ...RESPONSE_HEADERS, "x-request-id": rid },
      });
    }
    const answer = String(parsed?.answer || "").trim();
    const searchId = String(parsed?.search_id || "").trim();
    const topic = String(parsed?.topic || "").trim();
    const sources = Array.isArray(parsed?.sources) ? parsed.sources : null;
    if (
      !answer ||
      answer.length > 40_000 ||
      !UUID_RE.test(searchId) ||
      !topic ||
      topic.length > 100 ||
      typeof parsed?.searched !== "boolean" ||
      !sources ||
      sources.length > 50 ||
      !sources.every((source: any) => sourceUrlAllowed(source?.url))
    ) {
      return new Response("Trusted web response unavailable", {
        status: 502,
        headers: { ...RESPONSE_HEADERS, "x-request-id": rid },
      });
    }

    return new Response(answer, {
      status: 200,
      headers: {
        ...RESPONSE_HEADERS,
        "x-request-id": rid,
        "X-VS-Response-Runtime": "trusted_web_v1",
        "X-VS-Search-Id": searchId,
        "X-VS-Web-Topic": topic,
        "X-VS-Web-Searched": parsed.searched ? "1" : "0",
      },
    });
  } catch (error: unknown) {
    const timedOut = isAbortLike(error);
    return new Response(
      timedOut
        ? "Trusted web search timed out"
        : "Trusted web search unavailable",
      {
        status: timedOut ? 504 : 502,
        headers: { ...RESPONSE_HEADERS, "x-request-id": rid },
      },
    );
  }
}
