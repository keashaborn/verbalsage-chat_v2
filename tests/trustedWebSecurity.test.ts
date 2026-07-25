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
  assert.match(registry, /category: "web_search"/);
  assert.match(registry, /backendEnforced: true/);
});

test("trusted web BFF requires fresh Supabase authorization", () => {
  const route = source("app/api/trusted-web/route.ts");
  const newsRoute = source("app/api/current-news/route.ts");
  const auth = source("app/api/_auth/supabaseUser.ts");
  assert.match(route, /requireFreshCapability\(req, "web_search\.use"\)/);
  assert.match(newsRoute, /requireFreshCapability\(req, "web_search\.use"\)/);
  assert.match(auth, /\/auth\/v1\/user/);
  assert.match(auth, /cache: "no-store"/);
  assert.match(auth, /String\(user\.id \|\| ""\) !== payload\.sub/);
  assert.match(auth, /getSupabaseBearerAuthorizationFromRequest/);
  assert.match(route, /authorization: actorAuthorization/);
  assert.match(newsRoute, /authorization: actorAuthorization/);
  assert.doesNotMatch(route, /user_metadata/);
});

test("browser request cannot choose model, domains, topic, or storage", () => {
  const route = source("app/api/trusted-web/route.ts");
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(route, /Object\.keys\(record\)\.length !== 1/);
  assert.match(route, /hasOwnProperty\.call\(record, "query"\)/);
  assert.match(pane, /externalWeb\s*\n\s*\? \{ query: requestQuery \}/);
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
  assert.match(route, /answerLinksAllowed\(answer, sourceUrlAllowed\)/);
  assert.match(newsRoute, /answerLinksAllowed\(answer, sourceUrlAllowed\)/);
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
});

test("composer search has auto mode and remains disabled for voice", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(pane, /type WebMode = "auto" \| "off" \| "trusted_health" \| "current_news"/);
  assert.match(
    pane,
    /const \[webMode, setWebMode\] = React\.useState<WebMode>\("auto"\)/,
  );
  assert.match(pane, /webModeExternalEnabled\(webMode\)/);
  assert.match(pane, /classifyAutoWebMode\(msg\)/);
  assert.match(pane, /AUTO_CURRENT_NEWS_INTENT_TERMS/);
  assert.match(pane, /AUTO_HEALTH_EVIDENCE_INTENT_TERMS/);
  assert.match(pane, /webModeTrustedHealthEnabled\(selectedWebMode\)/);
  assert.match(pane, /webModeCurrentNewsEnabled\(selectedWebMode\)/);
  assert.match(pane, /data-web-mode-selector/);
  assert.match(pane, /value=\{webMode\}/);
  assert.match(pane, /Trusted sources · Not saved to memory/);
  assert.equal((pane.match(/Trusted sources · Not saved to memory/g) || []).length, 2);
  assert.match(pane, /<option value="auto">Auto<\/option>/);
  assert.match(pane, /<option value="trusted_health">Health<\/option>/);
  assert.match(pane, /<option value="current_news">News<\/option>/);
  assert.match(pane, /currentNews\s*\? "\/api\/current-news"/);
  assert.match(pane, /const requestQuery = input/);
  assert.doesNotMatch(pane, /buildCurrentNewsContextualQuery/);
  assert.doesNotMatch(pane, /Recent conversation context/);
  assert.match(pane, /any current news/);
  assert.match(pane, /search the web/);
  assert.doesNotMatch(pane, /AUTO_CURRENT_NEWS_INTENT_TERMS = \[[\s\S]*what's going on with[\s\S]*\]/);
  assert.doesNotMatch(pane, /AUTO_CURRENT_NEWS_INTENT_TERMS = \[[\s\S]*what is happening with[\s\S]*\]/);
  assert.doesNotMatch(pane, /CURRENT_NEWS_CONTEXT_MAX_CHARS/);
  assert.doesNotMatch(pane, /CURRENT_NEWS_CONTEXT_MESSAGES/);
  assert.match(pane, /setWebMode\("off"\)/);
  assert.doesNotMatch(pane, /localStorage.*webMode/);
});

test("trusted-search markdown links are restricted to returned source hosts", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  const markdown = source("components/shared/MarkdownMessage.tsx");
  assert.match(pane, /allowedLinkUrls=\{/);
  assert.match(pane, /m\.web_search/);
  assert.match(pane, /m\.trusted_web_sources/);
  assert.match(markdown, /allowedLinkUrls\?: readonly string\[\]/);
  assert.match(markdown, /target\.protocol !== "https:"/);
  assert.match(markdown, /source\.hostname/);
  assert.match(markdown, /linkAllowed\(href\)/);
});


test("trusted web preserves structured source metadata for source cards", () => {
  const route = source("app/api/trusted-web/route.ts");
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(route, /Response\.json/);
  assert.match(route, /normalizeSource/);
  assert.match(route, /authority_type/);
  assert.match(route, /evidence_type/);
  assert.match(pane, /type TrustedWebSource/);
  assert.match(pane, /TrustedWebSourceCards/);
  assert.match(pane, /trusted_web_sources/);
  assert.match(pane, /official_public_guidance/);
  assert.match(pane, /pubmed_research/);
  assert.match(pane, /Official source/);
  assert.match(pane, /News source/);
});

test("trusted web source cards replace plain trailing source list", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(pane, /stripTrustedWebSourceList/);
  assert.match(pane, /Sources:/);
  assert.match(pane, /Sources: \{trustedWebSourceSummary\(visible\)\}/);
  assert.match(pane, /<details/);
  assert.match(pane, /<summary/);
});


test("trusted web source cards use a single link per source", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  const start = pane.indexOf("function TrustedWebSourceCards");
  const end = pane.indexOf("async function fetchJson", start);
  const block = pane.slice(start, end);
  assert.equal((block.match(/<a\b/g) || []).length, 1);
  assert.match(block, /trustedWebSourceSummary/);
  assert.match(block, /trustedWebHostLabel/);
  assert.match(block, /no-underline/);
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
  assert.match(pane, /Web search was not used because this question was outside trusted-source scope\./);
  assert.match(pane, /if \(!reply\.trustedWeb\)/);
});
