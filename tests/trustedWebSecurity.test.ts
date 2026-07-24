import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
  const auth = source("app/api/_auth/supabaseUser.ts");
  assert.match(route, /requireFreshCapability\(req, "web_search\.use"\)/);
  assert.match(auth, /\/auth\/v1\/user/);
  assert.match(auth, /cache: "no-store"/);
  assert.match(auth, /String\(user\.id \|\| ""\) !== payload\.sub/);
  assert.doesNotMatch(route, /user_metadata/);
});

test("browser request cannot choose model, domains, topic, or storage", () => {
  const route = source("app/api/trusted-web/route.ts");
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(route, /Object\.keys\(record\)\.length !== 1/);
  assert.match(route, /hasOwnProperty\.call\(record, "query"\)/);
  assert.match(pane, /trustedWeb\s*\?\s*\{ query: input \}/);
  assert.doesNotMatch(pane, /allowed_domains/);
  assert.doesNotMatch(pane, /external_web_access/);
});

test("trusted web uses the internal service boundary and no memory route", () => {
  const route = source("app/api/trusted-web/route.ts");
  assert.match(route, /brainsUpstreamHeaders\(rid, userId\)/);
  assert.match(route, /\/trusted-web\/query/);
  assert.doesNotMatch(route, /\/response\/query/);
  assert.doesNotMatch(route, /\/log/);
  assert.match(route, /no-store/);
});

test("BFF revalidates returned source domains", () => {
  const route = source("app/api/trusted-web/route.ts");
  assert.match(route, /ALLOWED_SOURCE_DOMAINS/);
  assert.match(route, /parsed\.protocol !== "https:"/);
  assert.match(route, /parsed\.username/);
  assert.match(route, /parsed\.port/);
  assert.match(route, /normalizeSource/);
  assert.match(route, /sourceUrlAllowed\(url\)/);
});

test("composer search is explicit, off by default, and disabled for voice", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(
    pane,
    /const \[webSearchEnabled, setWebSearchEnabled\] = React\.useState\(false\)/,
  );
  assert.match(pane, /data-trusted-web-toggle/);
  assert.match(pane, /aria-pressed=\{webSearchEnabled\}/);
  assert.match(pane, /Trusted sources · Not saved to memory/);
  assert.match(pane, /setWebSearchEnabled\(false\)/);
  assert.doesNotMatch(pane, /localStorage.*webSearchEnabled/);
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
});

test("trusted web source cards replace plain trailing source list", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  assert.match(pane, /stripTrustedWebSourceList/);
  assert.match(pane, /Sources:/);
  assert.match(pane, /Trusted sources/);
});


test("trusted web source cards use a single link per source", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  const start = pane.indexOf("function TrustedWebSourceCards");
  const end = pane.indexOf("async function fetchJson", start);
  const block = pane.slice(start, end);
  assert.equal((block.match(/<a\b/g) || []).length, 1);
  assert.match(block, /trustedWebHostLabel/);
  assert.match(block, /no-underline/);
});
