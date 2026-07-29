export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import { getSupabaseBearerAuthorizationFromRequest } from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import {
  manualSearchResponseTraceV2,
  responseTraceAccessAllowedForFreshRoleV2,
  responseTraceHeadersV2,
} from "@/app/api/_inspection/responseTraceV2";
import { answerLinksAllowed } from "@/app/api/_trusted-web/answerLinks";
import {
  recordManualSearchOverrideV1,
  searchCapabilityForInvocationV1,
} from "@/app/api/_trusted-web/searchInvocation";
import { recordSearchDecisionShadowV1 } from "@/lib/searchDecisionV1";
import { isAbortLike, requestDeadlineSignal } from "@/lib/requestDeadline";
import { TRUSTED_EVIDENCE_ALLOWED_SOURCE_DOMAINS } from "@/lib/trustedSourceRegistryV1";
import { WEB_SOURCE_PROVENANCE_CONTRACT } from "@/lib/webSourceProvenanceV2";
import {
  CITATION_EVIDENCE_CONTRACT,
  isCitationAggregateFreshnessStatus,
  isCitationSourceFreshnessStatus,
} from "@/lib/citationEvidenceV1";
import {
  TRUSTED_HEALTH_MAX_ADMITTED_SOURCES,
  WEB_EVIDENCE_ADMISSION_CONTRACT,
} from "@/lib/webEvidenceAdmissionV1";

const TRUSTED_WEB_TIMEOUT_MS = 55_000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FALLBACK_TO_CHAT_STATUS = 200;
const ALLOWED_SOURCE_DOMAINS = new Set(
  TRUSTED_EVIDENCE_ALLOWED_SOURCE_DOMAINS,
);
const ERROR_RESPONSE_HEADERS = {
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

const JSON_RESPONSE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
};

function sourceText(value: unknown, maxLength: number): string {
  return typeof value === "string" && value.trim().length <= maxLength
    ? value.trim()
    : "";
}

type TrustedWebSource = {
  url: string;
  title: string;
  authority_type: string;
  evidence_type: string;
  source_id: string;
  published_at: string;
  freshness_status: string;
};

function normalizeSource(source: unknown): TrustedWebSource | null {
  const record =
    source && typeof source === "object"
      ? (source as Record<string, unknown>)
      : null;
  const url = sourceText(record?.url, 4_096);
  const title = sourceText(record?.title, 500);
  const authorityType = sourceText(record?.authority_type, 80);
  const evidenceType = sourceText(record?.evidence_type, 80);
  const sourceId = sourceText(record?.source_id, 120);
  const publishedAt = sourceText(record?.published_at, 80);
  const freshnessStatus = sourceText(record?.freshness_status, 40);
  if (
    !url ||
    !title ||
    !authorityType ||
    !evidenceType ||
    !isCitationSourceFreshnessStatus(freshnessStatus)
  ) {
    return null;
  }
  if (!sourceUrlAllowed(url)) return null;
  return {
    url,
    title,
    authority_type: authorityType,
    evidence_type: evidenceType,
    source_id: sourceId,
    published_at: publishedAt,
    freshness_status: freshnessStatus,
  };
}

function sourcesBelongToSources(
  childSources: Array<{ url: string }>,
  parentSources: Array<{ url: string }>,
): boolean {
  const parentUrls = new Set(parentSources.map((source) => source.url));
  return childSources.every((source) => parentUrls.has(source.url));
}

function boundedSourceCount(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 50
    ? value
    : null;
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
      return new Response("Invalid trusted web request", {
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
    const includeInspection = await responseTraceAccessAllowedForFreshRoleV2(
      capability.role,
    );

    recordManualSearchOverrideV1({
      actorUserId: userId,
      requestId: rid,
      route: "trusted_health",
      invocation,
    });
    const searchDecision = recordSearchDecisionShadowV1({
      actorUserId: userId,
      requestId: rid,
      observedRoute: "trusted_health",
      input: query,
    });
    if (searchDecision.reason_codes.includes("search_prohibited_by_user")) {
      const traceHeaders = includeInspection
        ? responseTraceHeadersV2(
            manualSearchResponseTraceV2({
              rid,
              route: "trusted_health",
              searched: false,
              sourceCount: 0,
              prohibited: true,
            }),
          )
        : {};
      return new Response("Search prohibited by user", {
        status: 409,
        headers: {
          ...ERROR_RESPONSE_HEADERS,
          "x-request-id": rid,
          "X-VS-Search-Decision": "no_search",
          ...traceHeaders,
        },
      });
    }

    const brains = process.env.BRAINS_URL || "http://172.31.32.171:8088";
    const upstream = await fetch(`${brains}/trusted-web/query`, {
      method: "POST",
      headers: brainsUpstreamHeaders(rid, userId, {
        authorization: actorAuthorization,
      }),
      body: JSON.stringify({ user_id: userId, query }),
      cache: "no-store",
      signal: requestDeadlineSignal(TRUSTED_WEB_TIMEOUT_MS, req.signal),
    });
    const raw = await upstream.text().catch(() => "");
    if (raw.length > 65_536) {
      return new Response("Trusted web response unavailable", {
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
          ? "Trusted web rate limit reached"
          : status === 504
            ? "Trusted web search timed out"
            : "Trusted web search unavailable",
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
      return new Response("Trusted web response unavailable", {
        status: 502,
        headers: { ...ERROR_RESPONSE_HEADERS, "x-request-id": rid },
      });
    }
    const answer = String(parsed?.answer || "").trim();
    const searchId = String(parsed?.search_id || "").trim();
    const topic = String(parsed?.topic || "").trim();
    const sourceContract = String(parsed?.source_contract || "").trim();
    const admissionContract = String(parsed?.admission_contract || "").trim();
    const citationEvidenceContract = String(
      parsed?.citation_evidence_contract || "",
    ).trim();
    const rawCitedSources: unknown[] | null = Array.isArray(
      parsed?.cited_sources,
    )
      ? (parsed.cited_sources as unknown[])
      : null;
    const rawAdmittedSources: unknown[] | null = Array.isArray(
      parsed?.admitted_sources,
    )
      ? (parsed.admitted_sources as unknown[])
      : null;
    const rawProviderConsultedSources: unknown[] | null = Array.isArray(
      parsed?.consulted_sources,
    )
      ? (parsed.consulted_sources as unknown[])
      : null;
    const citedSources = rawCitedSources
      ? rawCitedSources
          .map(normalizeSource)
          .filter((source): source is TrustedWebSource => source !== null)
      : null;
    const admittedSources = rawAdmittedSources
      ? rawAdmittedSources
          .map(normalizeSource)
          .filter((source): source is TrustedWebSource => source !== null)
      : null;
    const providerConsultedSources = rawProviderConsultedSources
      ? rawProviderConsultedSources
          .map(normalizeSource)
          .filter((source): source is TrustedWebSource => source !== null)
      : null;
    const providerConsultedSourceCount = boundedSourceCount(
      parsed?.provider_consulted_source_count,
    );
    const admittedSourceCount = boundedSourceCount(
      parsed?.admitted_source_count,
    );
    const rejectedSourceCount = boundedSourceCount(
      parsed?.rejected_source_count,
    );
    const maxAdmittedSources = boundedSourceCount(parsed?.max_admitted_sources);
    const citationExactPageSourceCount = boundedSourceCount(
      parsed?.citation_exact_page_source_count,
    );
    const citationFreshnessVerifiedSourceCount = boundedSourceCount(
      parsed?.citation_freshness_verified_source_count,
    );
    const citationArchivedSourceCount = boundedSourceCount(
      parsed?.citation_archived_source_count,
    );
    const citationFreshnessStatus = String(
      parsed?.citation_freshness_status || "",
    ).trim();
    if (
      !answer ||
      answer.length > 40_000 ||
      !UUID_RE.test(searchId) ||
      !topic ||
      topic.length > 100 ||
      typeof parsed?.searched !== "boolean" ||
      sourceContract !== WEB_SOURCE_PROVENANCE_CONTRACT ||
      admissionContract !== WEB_EVIDENCE_ADMISSION_CONTRACT ||
      citationEvidenceContract !== CITATION_EVIDENCE_CONTRACT ||
      !citedSources ||
      !admittedSources ||
      !providerConsultedSources ||
      citedSources.length > 50 ||
      admittedSources.length > TRUSTED_HEALTH_MAX_ADMITTED_SOURCES ||
      providerConsultedSources.length > 50 ||
      maxAdmittedSources !== TRUSTED_HEALTH_MAX_ADMITTED_SOURCES ||
      providerConsultedSourceCount !== providerConsultedSources.length ||
      admittedSourceCount !== admittedSources.length ||
      rejectedSourceCount !==
        providerConsultedSources.length - admittedSources.length ||
      citationExactPageSourceCount !== citedSources.length ||
      citationFreshnessVerifiedSourceCount === null ||
      citationArchivedSourceCount === null ||
      citationFreshnessVerifiedSourceCount +
          citationArchivedSourceCount >
        citedSources.length ||
      !isCitationAggregateFreshnessStatus(citationFreshnessStatus) ||
      (parsed.searched === true && citedSources.length < 1) ||
      !sourcesBelongToSources(citedSources, admittedSources) ||
      !sourcesBelongToSources(admittedSources, providerConsultedSources) ||
      !answerLinksAllowed(
        answer,
        sourceUrlAllowed,
        citedSources.map((source) => source.url),
      )
    ) {
      return new Response("Trusted web response unavailable", {
        status: 502,
        headers: { ...ERROR_RESPONSE_HEADERS, "x-request-id": rid },
      });
    }

    if (parsed.searched !== true) {
      return Response.json(
        {
          fallback: "chat",
          reason: String(parsed?.reason || "trusted_web_not_used").slice(
            0,
            100,
          ),
          topic,
          searched: false,
        },
        {
          status: FALLBACK_TO_CHAT_STATUS,
          headers: {
            ...JSON_RESPONSE_HEADERS,
            "x-request-id": rid,
            "X-VS-Trusted-Web-Fallback": "chat",
            "X-VS-Web-Topic": topic,
            "X-VS-Web-Searched": "0",
            "X-VS-Web-Source-Count": "0",
            "X-VS-Web-Cited-Source-Count": "0",
            "X-VS-Web-Admitted-Source-Count": "0",
            "X-VS-Web-Provider-Consulted-Source-Count": "0",
            "X-VS-Web-Consulted-Source-Count": "0",
            "X-VS-Web-Rejected-Source-Count": "0",
            ...(includeInspection
              ? responseTraceHeadersV2(
                  manualSearchResponseTraceV2({
                    rid,
                    route: "trusted_health",
                    searched: false,
                    sourceCount: 0,
                    fallbackToChat: true,
                  }),
                )
              : {}),
          },
        },
      );
    }

    return Response.json(
      {
        answer,
        search_id: searchId,
        topic,
        searched: Boolean(parsed.searched),
        source_contract: sourceContract,
        admission_contract: admissionContract,
        citation_evidence_contract: citationEvidenceContract,
        citation_exact_page_source_count: citationExactPageSourceCount,
        citation_freshness_verified_source_count:
          citationFreshnessVerifiedSourceCount,
        citation_archived_source_count: citationArchivedSourceCount,
        citation_freshness_status: citationFreshnessStatus,
        sources: citedSources,
        cited_sources: citedSources,
        admitted_sources: admittedSources,
        provider_consulted_source_count: providerConsultedSourceCount,
        admitted_source_count: admittedSourceCount,
        rejected_source_count: rejectedSourceCount,
      },
      {
        status: 200,
        headers: {
          ...JSON_RESPONSE_HEADERS,
          "x-request-id": rid,
          "X-VS-Response-Runtime": "trusted_web_v1",
          "X-VS-Search-Id": searchId,
          "X-VS-Web-Topic": topic,
          "X-VS-Web-Searched": parsed.searched ? "1" : "0",
          "X-VS-Web-Source-Count": String(admittedSources.length),
          "X-VS-Web-Cited-Source-Count": String(citedSources.length),
          "X-VS-Web-Admitted-Source-Count": String(admittedSources.length),
          "X-VS-Web-Provider-Consulted-Source-Count": String(
            providerConsultedSources.length,
          ),
          "X-VS-Web-Consulted-Source-Count": String(
            providerConsultedSources.length,
          ),
          "X-VS-Web-Rejected-Source-Count": String(rejectedSourceCount),
          "X-VS-Citation-Evidence-Contract": citationEvidenceContract,
          "X-VS-Citation-Freshness": citationFreshnessStatus,
          ...(includeInspection
            ? responseTraceHeadersV2(
                manualSearchResponseTraceV2({
                  rid,
                  route: "trusted_health",
                  searched: Boolean(parsed.searched),
                  sourceCount: admittedSources.length,
                  citedSourceCount: citedSources.length,
                  admittedSourceCount: admittedSources.length,
                  consultedSourceCount: providerConsultedSources.length,
                  rejectedSourceCount,
                }),
              )
            : {}),
        },
      },
    );
  } catch (error: unknown) {
    const timedOut = isAbortLike(error);
    return new Response(
      timedOut
        ? "Trusted web search timed out"
        : "Trusted web search unavailable",
      {
        status: timedOut ? 504 : 502,
        headers: { ...ERROR_RESPONSE_HEADERS, "x-request-id": rid },
      },
    );
  }
}
