import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy current-news endpoint is a no-store compatibility tombstone", () => {
  const route = source("app/api/current-news/route.ts");
  assert.match(route, /status: 410/);
  assert.match(route, /Direct search route retired; use \/api\/chat\./);
  assert.match(route, /private, no-store/);
  assert.match(route, /X-VS-Search-Route-Status/);
  assert.doesNotMatch(route, /fetch\(/);
  assert.doesNotMatch(route, /requireFreshCapability/);
  assert.doesNotMatch(route, /recordSearchDecisionShadowV1/);
  assert.doesNotMatch(route, /web_search\.override/);
});

test("current news is reachable only through server-owned chat planning", () => {
  const chat = source("app/api/chat/route.ts");
  const pane = source("components/threads/BrainsChatPane.tsx");
  const registry = source("lib/trustedSourceRegistryV1.ts");

  assert.match(chat, /serverSearchExecutionRequest/);
  assert.match(chat, /\/search\/execute/);
  assert.match(
    chat,
    /capabilityAllowsRole\("web_search\.use", permissionRole\)/,
  );
  assert.match(
    chat,
    /"x-vs-web-search-authorization": "supabase_fresh_web_search_v1"/,
  );
  assert.match(chat, /selectedRoute !== "normal_chat"/);
  assert.match(chat, /routedSearchResponse/);
  assert.doesNotMatch(chat, /web_search\.override/);
  assert.doesNotMatch(pane, /"\/api\/current-news"/);
  assert.doesNotMatch(pane, /search_override/);
  assert.match(registry, /openai\.com/);
  assert.match(registry, /huggingface\.co/);
  assert.match(registry, /apnews\.com/);
  assert.match(registry, /nhk\.or\.jp/);
});

test("chat preserves bounded source counts from the backend envelope", () => {
  const chat = source("app/api/chat/route.ts");
  assert.match(chat, /X-VS-Web-Cited-Source-Count/);
  assert.match(chat, /X-VS-Web-Admitted-Source-Count/);
  assert.match(chat, /X-VS-Web-Provider-Consulted-Source-Count/);
  assert.match(chat, /X-VS-Web-Rejected-Source-Count/);
  assert.match(chat, /boundedHeaderInteger/);
  assert.match(chat, /cited_sources: payload\?\.cited_sources/);
  assert.match(chat, /admitted_sources: payload\?\.admitted_sources/);
  assert.match(chat, /consulted_sources: payload\?\.consulted_sources/);
});
