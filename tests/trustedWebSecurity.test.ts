import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error Node's strip-types test runner loads the TypeScript file directly.
import { answerLinksAllowed } from "../app/api/_trusted-web/answerLinks.ts";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("trusted web capability is explicit and backend enforced", () => {
  const registry = source(
    "components/admin/settings/permissions/permissionRegistry.ts",
  );
  assert.match(registry, /key: "web_search\.use"/);
  assert.doesNotMatch(registry, /key: "web_search\.override"/);
  assert.match(registry, /category: "web_search"/);
  assert.match(registry, /backendEnforced: true/);
});

test("chat is the only active trusted-search entrypoint", () => {
  const route = source("app/api/trusted-web/route.ts");
  const newsRoute = source("app/api/current-news/route.ts");
  const chatRoute = source("app/api/chat/route.ts");
  const auth = source("app/api/_auth/supabaseUser.ts");
  for (const retiredRoute of [route, newsRoute]) {
    assert.match(retiredRoute, /status: 410/);
    assert.match(
      retiredRoute,
      /Direct search route retired; use \/api\/chat\./,
    );
    assert.match(retiredRoute, /private, no-store/);
    assert.doesNotMatch(retiredRoute, /fetch\(/);
    assert.doesNotMatch(retiredRoute, /requireFreshCapability/);
  }
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
  assert.doesNotMatch(chatRoute, /web_search\.override/);
  assert.doesNotMatch(chatRoute, /manualOverride/);
  assert.doesNotMatch(chatRoute, /recordManualSearchOverrideV1/);
  assert.match(auth, /\/auth\/v1\/user/);
  assert.match(auth, /cache: "no-store"/);
  assert.match(auth, /String\(user\.id \|\| ""\) !== payload\.sub/);
  assert.match(auth, /getSupabaseBearerAuthorizationFromRequest/);
});

test("browser request cannot choose search controls or provider policy", () => {
  const control = source("lib/serverSearchAuthorityV1.ts");
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(
    control,
    /if \(value\.search_override !== undefined\) return null/,
  );
  assert.match(pane, /authFetch\(\s*"\/api\/chat"/);
  assert.doesNotMatch(pane, /authFetch\(\s*"\/api\/trusted-web"/);
  assert.doesNotMatch(pane, /authFetch\(\s*"\/api\/current-news"/);
  assert.doesNotMatch(pane, /allowed_domains/);
  assert.doesNotMatch(pane, /external_web_access/);
  assert.doesNotMatch(pane, /search_override/);
});

test("composer preserves typed text and offers refresh on thread prep failure", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(pane, /STALE_CLIENT_THREAD_PREP_MESSAGE/);
  assert.match(pane, /The app may have updated\. Refresh and try again\./);
  assert.match(pane, /setText\(msg\)/);
  assert.match(pane, /setRequestRecoveryAction\("refresh"\)/);
  assert.match(pane, /Refresh app/);
  assert.match(pane, /window\.location\.reload\(\)/);
});

test("trusted web uses the server planner boundary and no browser route", () => {
  const chat = source("app/api/chat/route.ts");
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(chat, /brainsUpstreamHeaders\(rid, userId\)/);
  assert.match(chat, /\/search\/execute/);
  assert.match(chat, /cache: "no-store"/);
  assert.doesNotMatch(pane, /\/trusted-web\/query/);
  assert.doesNotMatch(pane, /\/current-news\/query/);
});

test("BFF forwards only bounded search headers and source envelopes", () => {
  const chat = source("app/api/chat/route.ts");
  assert.match(chat, /normalized === "x-request-id"/);
  assert.match(chat, /normalized\.startsWith\("x-vs-"\)/);
  assert.match(chat, /cited_sources: payload\?\.cited_sources/);
  assert.match(chat, /admitted_sources: payload\?\.admitted_sources/);
  assert.match(chat, /consulted_sources: payload\?\.consulted_sources/);
  assert.doesNotMatch(chat, /const headers = new Headers\(upstream\.headers\)/);
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
    answerLinksAllowed("See [injected](https://example.com/prompt).", allowed),
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
  assert.doesNotMatch(pane, /type SearchControl/);
  assert.doesNotMatch(pane, /classifyAutoWebMode/);
  assert.doesNotMatch(pane, /AUTO_CURRENT_NEWS_INTENT_TERMS/);
  assert.doesNotMatch(pane, /AUTO_HEALTH_EVIDENCE_INTENT_TERMS/);
  assert.doesNotMatch(pane, /isSearchExplicitlyProhibitedV1/);
  assert.doesNotMatch(pane, /search_mode:/);
  assert.match(pane, /authFetch\(\s*"\/api\/chat"/);
  assert.doesNotMatch(pane, /search_override/);
  assert.doesNotMatch(pane, /X-VS-Trusted-Web-Fallback/);
  assert.match(pane, /r\.headers\.get\("X-VS-Search-Route"\)/);
  assert.doesNotMatch(chatRoute, /searchMode === "auto"/);
  assert.match(chatRoute, /resolveServerSearchControlV1/);
  assert.doesNotMatch(chatRoute, /manualOverride/);
  assert.doesNotMatch(chatRoute, /web_search\.override/);
  assert.match(chatRoute, /serverSearchExecutionRequest/);
  assert.match(chatRoute, /\/search\/execute/);
  assert.match(chatRoute, /function searchExecutionResponseHeaders/);
  assert.match(chatRoute, /normalized\.startsWith\("x-vs-"\)/);
  assert.doesNotMatch(
    chatRoute,
    /const headers = new Headers\(upstream\.headers\)/,
  );
  assert.match(chatRoute, /runServerSearchPlan/);
  assert.match(chatRoute, /Object\.entries\(voiceTurnHeaders\(voiceTurnId\)\)/);
  assert.match(chatRoute, /includeInspection,\s+voiceTurn\.value/);
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
  assert.match(
    pane,
    /Current news sources could not be verified\. Please try again\./,
  );
  assert.match(
    pane,
    /Trusted web sources could not be verified\. Please try again\./,
  );
  assert.match(pane, /r\.status === 502 && externalWeb/);
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
  const chat = source("app/api/chat/route.ts");
  const pane = source("components/threads/BrainsChatPane.tsx");
  const provenance = source("lib/webSourceProvenanceV2.ts");
  assert.match(provenance, /web_source_provenance_v2/);
  assert.match(chat, /cited_sources: payload\?\.cited_sources/);
  assert.match(chat, /admitted_sources: payload\?\.admitted_sources/);
  assert.match(chat, /consulted_sources: payload\?\.consulted_sources/);
  assert.match(chat, /X-VS-Web-Cited-Source-Count/);
  assert.match(chat, /X-VS-Web-Admitted-Source-Count/);
  assert.match(chat, /normalized\.startsWith\("x-vs-"\)/);
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
  assert.match(pane, /Sources: \{trustedWebSourceSummary\(cited, admitted\)\}/);
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
  const chat = source("app/api/chat/route.ts");
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(
    chat,
    /payload\?\.executed !== true \|\| route === "normal_chat"/,
  );
  assert.match(chat, /fallbackToChat: payload\?\.fallback_to_chat === true/);
  assert.match(chat, /const log = await fetch\(`\$\{brains\}\/log`/);
  assert.match(
    chat,
    /const upstream = await fetch\(`\$\{brains\}\/response\/query`/,
  );
  assert.doesNotMatch(pane, /X-VS-Trusted-Web-Fallback/);
  assert.doesNotMatch(pane, /trustedWebFallback: true/);
  assert.match(pane, /trustedWebFallback: false/);
  assert.match(pane, /void loadMessages\(tid/);
  assert.match(pane, /trusted_web_fallback: true/);
  assert.match(
    pane,
    /Web search was not used because this question was\s+outside trusted-source scope\./,
  );
  assert.match(pane, /if \(!reply\.trustedWeb\)/);
});
