import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("current news manual route requires fresh override authorization", () => {
  const route = source("app/api/current-news/route.ts");
  const invocation = source("app/api/_trusted-web/searchInvocation.ts");
  assert.match(route, /searchCapabilityForInvocationV1\(invocation\)/);
  assert.match(invocation, /"web_search\.use" \| "web_search\.override"/);
  assert.match(invocation, /\? "web_search\.use"\s*: "web_search\.override"/);
  assert.match(route, /requireFreshCapability\(req, requiredCapability\)/);
  assert.match(route, /recordManualSearchOverrideV1/);
  assert.doesNotMatch(route, /user_metadata/);
});

test("current news browser request cannot choose model domains topic or storage", () => {
  const route = source("app/api/current-news/route.ts");
  assert.match(route, /Object\.keys\(record\)\.length !== 1/);
  assert.match(route, /hasOwnProperty\.call\(record, "query"\)/);
  assert.doesNotMatch(route, /allowed_domains/);
  assert.doesNotMatch(route, /external_web_access/);
});

test("current news uses internal service boundary and no memory route", () => {
  const route = source("app/api/current-news/route.ts");
  assert.match(route, /brainsUpstreamHeaders\(rid, userId, \{/);
  assert.match(route, /\/current-news\/query/);
  assert.doesNotMatch(route, /\/response\/query/);
  assert.doesNotMatch(route, /\/log/);
  assert.match(route, /no-store/);
});

test("current news BFF revalidates returned source domains", () => {
  const route = source("app/api/current-news/route.ts");
  assert.match(route, /ALLOWED_SOURCE_DOMAINS/);
  assert.match(route, /openai\.com/);
  assert.match(route, /huggingface\.co/);
  assert.match(route, /apnews\.com/);
  assert.match(route, /parsed\.protocol !== "https:"/);
  assert.match(route, /parsed\.username/);
  assert.match(route, /parsed\.port/);
  assert.match(route, /normalizeSource/);
  assert.match(route, /sourceUrlAllowed\(url\)/);
});

test("current news BFF preserves structured skeleton fields", () => {
  const route = source("app/api/current-news/route.ts");
  assert.match(route, /current_news_v1/);
  assert.match(route, /reason/);
  assert.match(route, /searched: Boolean\(parsed\.searched\)/);
  assert.match(route, /sources/);
  assert.match(route, /authority_type: sourceType/);
  assert.match(route, /evidence_type: "current_news"/);
});
