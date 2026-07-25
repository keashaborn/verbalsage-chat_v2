import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error Node's strip-types test runner loads the TypeScript file directly.
import { answerLinksAllowed } from "../app/api/_trusted-web/answerLinks.ts";
// @ts-expect-error Node's strip-types test runner loads the TypeScript file directly.
import {
  AUTOMATIC_SEARCH_INVOCATION_V1,
  recordManualSearchOverrideV1,
  searchCapabilityForInvocationV1,
} from "../app/api/_trusted-web/searchInvocation.ts";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("trusted web capability is explicit and backend enforced", () => {
  const registry = source(
    "components/admin/settings/permissions/permissionRegistry.ts",
  );
  assert.match(registry, /key: "web_search\.use"/);
  assert.match(registry, /key: "web_search\.override"/);
  assert.match(registry, /category: "web_search"/);
  assert.match(registry, /backendEnforced: true/);
});

test("trusted web distinguishes automatic use from manual override", () => {
  const route = source("app/api/trusted-web/route.ts");
  const newsRoute = source("app/api/current-news/route.ts");
  const chatRoute = source("app/api/chat/route.ts");
  const invocation = source("app/api/_trusted-web/searchInvocation.ts");
  const auth = source("app/api/_auth/supabaseUser.ts");
  assert.match(route, /searchCapabilityForInvocationV1\(invocation\)/);
  assert.match(newsRoute, /searchCapabilityForInvocationV1\(invocation\)/);
  assert.match(route, /requireFreshCapability\(req, requiredCapability\)/);
  assert.match(newsRoute, /requireFreshCapability\(req, requiredCapability\)/);
  assert.match(invocation, /AUTOMATIC_SEARCH_INVOCATION_V1 = Symbol/);
  assert.match(invocation, /\? "web_search\.use"\s*: "web_search\.override"/);
  assert.match(chatRoute, /serverSearchExecutionRequest/);
  assert.match(chatRoute, /\/search\/execute/);
  assert.match(chatRoute, /authorization,/);
  assert.match(
    chatRoute,
    /"x-vs-web-search-authorization": "supabase_fresh_web_search_v1"/,
  );
  assert.match(
    chatRoute,
    /capabilityAllowsRole\("web_search\.use", permissionRole\)/,
  );
  assert.doesNotMatch(chatRoute, /postCurrentNews/);
  assert.doesNotMatch(chatRoute, /postTrustedWeb/);
  assert.doesNotMatch(invocation, /headers|get\(|body|query/);
  assert.match(auth, /\/auth\/v1\/user/);
  assert.match(auth, /cache: "no-store"/);
  assert.match(auth, /String\(user\.id \|\| ""\) !== payload\.sub/);
  assert.match(auth, /getSupabaseBearerAuthorizationFromRequest/);
  assert.match(route, /authorization: actorAuthorization/);
  assert.match(newsRoute, /authorization: actorAuthorization/);
  assert.doesNotMatch(route, /user_metadata/);
});

test("manual override authority cannot be selected by HTTP input", () => {
  assert.equal(
    searchCapabilityForInvocationV1(AUTOMATIC_SEARCH_INVOCATION_V1),
    "web_search.use",
  );
  for (const untrustedValue of [
    undefined,
    null,
    "automatic",
    Symbol.for("verbalsage.automatic-search-invocation.v1"),
    { header: "automatic" },
  ]) {
    assert.equal(
      searchCapabilityForInvocationV1(untrustedValue),
      "web_search.override",
    );
  }
});

test("manual override audit is prompt-free and automatic routing is excluded", () => {
  const originalInfo = console.info;
  const originalAuditFlag = process.env.SEARCH_DECISION_AUDIT_ENABLED;
  const logged: string[] = [];
  console.info = (...values: unknown[]) => {
    logged.push(values.map(String).join(" "));
  };
  process.env.SEARCH_DECISION_AUDIT_ENABLED = "1";

  try {
    recordManualSearchOverrideV1({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      requestId: "manual-request-1",
      route: "current_news",
      invocation: undefined,
    });
    recordManualSearchOverrideV1({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      requestId: "automatic-request-1",
      route: "current_news",
      invocation: AUTOMATIC_SEARCH_INVOCATION_V1,
    });
  } finally {
    console.info = originalInfo;
    if (originalAuditFlag === undefined) {
      delete process.env.SEARCH_DECISION_AUDIT_ENABLED;
    } else {
      process.env.SEARCH_DECISION_AUDIT_ENABLED = originalAuditFlag;
    }
  }

  assert.equal(logged.length, 1);
  const event = JSON.parse(logged[0]);
  assert.equal(event.event, "search_manual_override_v1");
  assert.equal(event.capability, "web_search.override");
  assert.equal(event.selected_route, "current_news");
  assert.doesNotMatch(logged[0], /prompt|query|input/);
});

test("browser request cannot choose model, domains, topic, or storage", () => {
  const route = source("app/api/trusted-web/route.ts");
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(route, /Object\.keys\(record\)\.length !== 1/);
  assert.match(route, /hasOwnProperty\.call\(record, "query"\)/);
  assert.match(pane, /authFetch\(\s*"\/api\/chat"/);
  assert.doesNotMatch(pane, /authFetch\(\s*"\/api\/trusted-web"/);
  assert.doesNotMatch(pane, /authFetch\(\s*"\/api\/current-news"/);
  assert.doesNotMatch(pane, /allowed_domains/);
  assert.doesNotMatch(pane, /external_web_access/);
});

test("trusted web uses the internal service boundary and no memory route", () => {
  const route = source("app/api/trusted-web/route.ts");
  assert.match(route, /brainsUpstreamHeaders\(rid, userId, \{/);
  assert.match(route, /\/trusted-web\/query/);
  assert.doesNotMatch(route, /\/response\/query/);
  assert.doesNotMatch(route, /\/log/);
  assert.match(route, /no-store/);
});

test("BFF revalidates returned source domains", () => {
  const route = source("app/api/trusted-web/route.ts");
  const newsRoute = source("app/api/current-news/route.ts");
  assert.match(route, /ALLOWED_SOURCE_DOMAINS/);
  assert.match(route, /parsed\.protocol !== "https:"/);
  assert.match(route, /parsed\.username/);
  assert.match(route, /parsed\.port/);
  assert.match(route, /normalizeSource/);
  assert.match(route, /sourceUrlAllowed\(url\)/);
  assert.match(route, /answerLinksAllowed\(/);
  assert.match(route, /citedSources\.map\(\(source\) => source\.url\)/);
  assert.match(newsRoute, /answerLinksAllowed\(/);
  assert.match(newsRoute, /citedSources\.map\(\(source\) => source\.url\)/);
});

test("answer links fail closed outside the server allowlist", () => {
  const allowed = (raw: unknown) => {
    try {
      return new URL(String(raw)).hostname === "openai.com";
    } catch {
      return false;
    }
  };
  assert.equal(
    answerLinksAllowed(
      "See [the source](https://openai.com/news/example).",
      allowed,
    ),
    true,
  );
  assert.equal(
    answerLinksAllowed(
      "See [injected](https://example.com/prompt).",
      allowed,
    ),
    false,
  );
  assert.equal(
    answerLinksAllowed("See [injected](javascript:alert(1)).", allowed),
    false,
  );
  assert.equal(answerLinksAllowed("Visit www.example.com.", allowed), false);
  assert.equal(
    answerLinksAllowed("Contact attacker@example.com.", allowed),
    false,
  );
  assert.equal(
    answerLinksAllowed(
      "See [the source](https://openai.com/news/example/?utm_source=openai).",
      allowed,
      ["https://openai.com/news/example"],
    ),
    true,
  );
  assert.equal(
    answerLinksAllowed(
      "See [another page](https://openai.com/news/other).",
      allowed,
      ["https://openai.com/news/example"],
    ),
    false,
  );
});

test("composer hides test modes and delegates every normal request to the server", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  const chatRoute = source("app/api/chat/route.ts");
  assert.match(pane, /type SearchControl = "auto" \| "off"/);
  assert.doesNotMatch(pane, /classifyAutoWebMode/);
  assert.doesNotMatch(pane, /AUTO_CURRENT_NEWS_INTENT_TERMS/);
  assert.doesNotMatch(pane, /AUTO_HEALTH_EVIDENCE_INTENT_TERMS/);
  assert.doesNotMatch(pane, /isSearchExplicitlyProhibitedV1/);
  assert.doesNotMatch(pane, /search_mode:/);
  assert.match(pane, /authFetch\(\s*"\/api\/chat"/);
  assert.match(pane, /search_override: "off"/);
  assert.match(pane, /r\.headers\.get\("X-VS-Search-Route"\)/);
  assert.doesNotMatch(chatRoute, /searchMode === "auto"/);
  assert.match(chatRoute, /resolveServerSearchControlV1/);
  assert.match(chatRoute, /manualOverride/);
  assert.match(chatRoute, /serverSearchExecutionRequest/);
  assert.match(chatRoute, /\/search\/execute/);
  assert.match(chatRoute, /function searchExecutionResponseHeaders/);
  assert.match(chatRoute, /normalized\.startsWith\("x-vs-"\)/);
  assert.doesNotMatch(
    chatRoute,
    /const headers = new Headers\(upstream\.headers\)/,
  );
  assert.match(chatRoute, /runServerSearchPlan/);
  assert.doesNotMatch(chatRoute, /selectAutomaticSearchRouteV1/);
  assert.doesNotMatch(chatRoute, /runAutomaticSearch/);
  assert.match(chatRoute, /getSupabaseBearerAuthorizationFromRequest/);
  assert.doesNotMatch(pane, /data-web-mode-selector/);
  assert.doesNotMatch(pane, /aria-label="Web mode"/);
  assert.doesNotMatch(pane, /web_search\.override/);
  assert.doesNotMatch(pane, /<option value="auto">Auto<\/option>/);
  assert.doesNotMatch(pane, /<option value="trusted_health">Health<\/option>/);
  assert.doesNotMatch(pane, /<option value="current_news">News<\/option>/);
  assert.doesNotMatch(pane, /"\/api\/trusted-web"/);
  assert.doesNotMatch(pane, /"\/api\/current-news"/);
  assert.doesNotMatch(pane, /buildCurrentNewsContextualQuery/);
  assert.doesNotMatch(pane, /Recent conversation context/);
  assert.doesNotMatch(pane, /CURRENT_NEWS_CONTEXT_MAX_CHARS/);
  assert.doesNotMatch(pane, /CURRENT_NEWS_CONTEXT_MESSAGES/);
  assert.doesNotMatch(pane, /setWebMode/);
  assert.doesNotMatch(pane, /selectedWebMode/);
  assert.doesNotMatch(pane, /localStorage.*webMode/);
});

test("trusted-search markdown links are restricted to exact cited URLs", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  const markdown = source("components/shared/MarkdownMessage.tsx");
  assert.match(pane, /allowedLinkUrls=\{/);
  assert.match(pane, /m\.web_search/);
  assert.match(pane, /m\.trusted_web_sources/);
  assert.match(markdown, /allowedLinkUrls\?: readonly string\[\]/);
  assert.match(markdown, /canonicalWebSourceUrl\(href\)/);
  assert.match(markdown, /canonicalWebSourceUrl\(sourceUrl\) === target/);
  assert.match(markdown, /linkAllowed\(href\)/);
});


test("trusted web preserves structured source metadata for source cards", () => {
  const route = source("app/api/trusted-web/route.ts");
  const pane = source("components/threads/BrainsChatPane.tsx");
  const provenance = source("lib/webSourceProvenanceV2.ts");
  assert.match(route, /Response\.json/);
  assert.match(route, /normalizeSource/);
  assert.match(route, /authority_type/);
  assert.match(route, /evidence_type/);
  assert.match(route, /WEB_SOURCE_PROVENANCE_CONTRACT/);
  assert.match(provenance, /web_source_provenance_v2/);
  assert.match(route, /cited_sources: citedSources/);
  assert.match(route, /admitted_sources: admittedSources/);
  assert.doesNotMatch(route, /consulted_sources: providerConsultedSources/);
  assert.match(route, /sourcesBelongToSources/);
  assert.match(route, /WEB_EVIDENCE_ADMISSION_CONTRACT/);
  assert.match(route, /TRUSTED_HEALTH_MAX_ADMITTED_SOURCES/);
  assert.match(pane, /type TrustedWebSource/);
  assert.match(pane, /TrustedWebSourceCards/);
  assert.match(pane, /trusted_web_sources/);
  assert.match(pane, /trusted_web_admitted_sources/);
  assert.doesNotMatch(pane, /trusted_web_consulted_sources/);
  assert.match(pane, /official_public_guidance/);
  assert.match(pane, /pubmed_research/);
  assert.match(pane, /Official source/);
  assert.match(pane, /News source/);
});

test("persisted trusted web sources are normalized before rendering", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(pane, /record\.source_type/);
  assert.match(
    pane,
    /trusted_web_sources:\s*normalizeTrustedWebSources\(\s*m\.trusted_web_sources/,
  );
  assert.match(
    pane,
    /trusted_web_admitted_sources:\s*normalizeTrustedWebSources\(\s*m\.trusted_web_admitted_sources/,
  );
  assert.match(pane, /String\(source\.evidence_type \|\| "web_evidence"\)/);
});

test("trusted web source cards replace plain trailing source list", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(pane, /stripTrustedWebSourceList/);
  assert.match(pane, /Sources:/);
  assert.match(
    pane,
    /Sources: \{trustedWebSourceSummary\(cited, admitted\)\}/,
  );
  assert.match(pane, /Cited in this answer/);
  assert.match(pane, /Additional supporting sources/);
  assert.match(pane, /trustedWebSourceDisplayTitle/);
  assert.match(pane, /<details/);
  assert.match(pane, /<summary/);
});


test("trusted web source cards use a single link per source", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  const start = pane.indexOf("function TrustedWebSourceCard");
  const end = pane.indexOf("function TrustedWebSourceCards", start);
  const block = pane.slice(start, end);
  assert.equal((block.match(/<a\b/g) || []).length, 1);
  assert.match(block, /return \(\s*<div\b/);
  assert.doesNotMatch(block, /return \(\s*<a\b/);
  assert.match(
    block,
    /<a[\s\S]*trustedWebSourceDisplayTitle\(source\)[\s\S]*<\/a>/,
  );
  assert.match(block, /trustedWebHostLabel/);
});


test("trusted web non-search responses fall back to normal chat", () => {
  const route = source("app/api/trusted-web/route.ts");
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(route, /FALLBACK_TO_CHAT_STATUS = 200/);
  assert.match(route, /parsed\.searched !== true/);
  assert.match(route, /X-VS-Trusted-Web-Fallback/);
  assert.match(pane, /X-VS-Trusted-Web-Fallback/);
  assert.match(pane, /trustedWebFallback: true/);
  assert.match(pane, /trustedWebFallback: false/);
  assert.match(pane, /if \(reply\.trustedWebFallback\)/);
  assert.match(pane, /void loadMessages\(tid/);
  assert.match(pane, /trusted_web_fallback: true/);
  assert.match(
    pane,
    /Web search was not used because this question was\s+outside trusted-source scope\./,
  );
  assert.match(pane, /if \(!reply\.trustedWeb\)/);
});
