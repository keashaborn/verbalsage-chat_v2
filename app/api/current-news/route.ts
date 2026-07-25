export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import { getSupabaseBearerAuthorizationFromRequest } from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import { answerLinksAllowed } from "@/app/api/_trusted-web/answerLinks";
import {
  recordManualSearchOverrideV1,
  searchCapabilityForInvocationV1,
} from "@/app/api/_trusted-web/searchInvocation";
import { recordSearchDecisionShadowV1 } from "@/lib/searchDecisionV1";
import { isAbortLike, requestDeadlineSignal } from "@/lib/requestDeadline";

const CURRENT_NEWS_TIMEOUT_MS = 25_000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_SOURCE_DOMAINS = new Set([
  "openai.com",
  "huggingface.co",
  "apnews.com",
  "reuters.com",
  "arstechnica.com",
  "wired.com",
  "theverge.com",
]);
const ERROR_RESPONSE_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
};
const JSON_RESPONSE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
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

function sourceText(value: unknown, maxLength: number): string {
  return typeof value === "string" && value.trim().length <= maxLength
    ? value.trim()
    : "";
}

function normalizeSource(source: any) {
  const url = sourceText(source?.url, 4_096);
  const title = sourceText(source?.title, 500);
  const publisher = sourceText(source?.publisher, 120);
  const publishedAt = sourceText(source?.published_at, 40);
  const sourceType = sourceText(source?.source_type, 80);
  if (!url || !title || !publisher || !sourceType) return null;
  if (!sourceUrlAllowed(url)) return null;
  return {
    url,
    title,
    publisher,
    published_at: publishedAt,
    source_type: sourceType,
    authority_type: sourceType,
    evidence_type: "current_news",
    ...(publishedAt ? { source_id: publishedAt } : {}),
  };
}

function boundedRetryAfter(value: string | null): string {
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 1 && seconds <= 300
    ? String(seconds)
    : "60";
}

export async function POST(req: Request, invocation?: unknown) {
  const rid = requestId(req);
  try {
    const query = parseQuery(await req.json().catch(() => null));
    if (!query) {
      return new Response("Invalid current news request", {
        status: 400,
        headers: { ...ERROR_RESPONSE_HEADERS, "x-request-id": rid },
      });
    }

    const requiredCapability = searchCapabilityForInvocationV1(invocation);
    const capability = await requireFreshCapability(req, requiredCapability);
    const capabilityAuth = capability.auth;
    if (!capability.ok || !capabilityAuth) {
      return new Response(
        capability.status === 403 ? "capability required" : "unauthorized",
        {
          status: capability.status,
          headers: { ...ERROR_RESPONSE_HEADERS, "x-request-id": rid },
        },
      );
    }

    const userId = capabilityAuth.user_id;
    const actorAuthorization = getSupabaseBearerAuthorizationFromRequest(req);
    if (!UUID_RE.test(userId) || !actorAuthorization) {
      return new Response("unauthorized", {
        status: 401,
        headers: { ...ERROR_RESPONSE_HEADERS, "x-request-id": rid },
      });
    }

    recordManualSearchOverrideV1({
      actorUserId: userId,
      requestId: rid,
      route: "current_news",
      invocation,
    });
    const searchDecision = recordSearchDecisionShadowV1({
      actorUserId: userId,
      requestId: rid,
      observedRoute: "current_news",
      input: query,
    });
    if (searchDecision.reason_codes.includes("search_prohibited_by_user")) {
      return new Response("Search prohibited by user", {
        status: 409,
        headers: {
          ...ERROR_RESPONSE_HEADERS,
          "x-request-id": rid,
          "X-VS-Search-Decision": "no_search",
        },
      });
    }

    const brains = process.env.BRAINS_URL || "http://172.31.32.171:8088";
    const upstream = await fetch(`${brains}/current-news/query`, {
      method: "POST",
      headers: brainsUpstreamHeaders(rid, userId, {
        authorization: actorAuthorization,
      }),
      body: JSON.stringify({ user_id: userId, query }),
      cache: "no-store",
      signal: requestDeadlineSignal(CURRENT_NEWS_TIMEOUT_MS, req.signal),
    });
    const raw = await upstream.text().catch(() => "");
    if (raw.length > 65_536) {
      return new Response("Current news response unavailable", {
        status: 502,
        headers: { ...ERROR_RESPONSE_HEADERS, "x-request-id": rid },
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
          ? "Current news rate limit reached"
          : status === 504
            ? "Current news lookup timed out"
            : "Current news lookup unavailable",
        {
          status,
          headers: {
            ...ERROR_RESPONSE_HEADERS,
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
      return new Response("Current news response unavailable", {
        status: 502,
        headers: { ...ERROR_RESPONSE_HEADERS, "x-request-id": rid },
      });
    }

    const answer = String(parsed?.answer || "").trim();
    const searchId = String(parsed?.search_id || "").trim();
    const topic = String(parsed?.topic || "").trim();
    const reason = String(parsed?.reason || "").trim();
    const rawSources = Array.isArray(parsed?.sources) ? parsed.sources : null;
    const sources = rawSources
      ? rawSources.map(normalizeSource).filter(Boolean)
      : null;
    if (
      !answer ||
      answer.length > 40_000 ||
      !UUID_RE.test(searchId) ||
      !topic ||
      topic.length > 100 ||
      reason.length > 120 ||
      typeof parsed?.searched !== "boolean" ||
      !sources ||
      sources.length > 50 ||
      !answerLinksAllowed(answer, sourceUrlAllowed)
    ) {
      return new Response("Current news response unavailable", {
        status: 502,
        headers: { ...ERROR_RESPONSE_HEADERS, "x-request-id": rid },
      });
    }

    return Response.json(
      {
        answer,
        search_id: searchId,
        topic,
        reason,
        searched: Boolean(parsed.searched),
        sources,
      },
      {
        status: 200,
        headers: {
          ...JSON_RESPONSE_HEADERS,
          "x-request-id": rid,
          "X-VS-Response-Runtime": "current_news_v1",
          "X-VS-Search-Id": searchId,
          "X-VS-Web-Topic": topic,
          "X-VS-Web-Searched": parsed.searched ? "1" : "0",
        },
      },
    );
  } catch (error: unknown) {
    const timedOut = isAbortLike(error);
    return new Response(
      timedOut
        ? "Current news lookup timed out"
        : "Current news lookup unavailable",
      {
        status: timedOut ? 504 : 502,
        headers: { ...ERROR_RESPONSE_HEADERS, "x-request-id": rid },
      },
    );
  }
}
