import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  resolveServerSearchControlV1,
  SERVER_SEARCH_AUTHORITY_VERSION,
} from "../lib/serverSearchAuthorityV1.ts";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy browser modes never control the server decision", () => {
  for (const body of [{}, { search_mode: "auto" }, { search_mode: "off" }]) {
    const control = resolveServerSearchControlV1(body);
    assert.ok(control);
    assert.equal(control.effective_mode, "auto");
    assert.equal(control.requested_override, null);
  }

  assert.deepEqual(
    resolveServerSearchControlV1({ search_mode: "off" })
      ?.ignored_legacy_request_fields,
    ["search_mode"],
  );
});

test("manual and malformed client search controls fail closed", () => {
  for (const body of [
    null,
    [],
    { search_mode: "health" },
    { search_override: "off" },
    { search_override: "auto" },
    { search_override: true },
  ]) {
    assert.equal(resolveServerSearchControlV1(body), null);
  }
});

test("chat route owns routing and uses fresh Supabase authorization", () => {
  const route = source("app/api/chat/route.ts");
  const pane = source("components/threads/BrainsChatPane.tsx");

  assert.equal(SERVER_SEARCH_AUTHORITY_VERSION, "server_search_authority_v1");
  assert.match(route, /resolveServerSearchControlV1\(body\)/);
  assert.match(route, /getFreshSupabaseAuthContextFromRequest\(req\)/);
  assert.doesNotMatch(route, /searchMode === "auto"/);
  assert.doesNotMatch(
    route,
    /searchControl\.effective_mode === "auto"\s*&&\s*!noStore/,
  );
  assert.doesNotMatch(route, /web_search\.override/);
  assert.doesNotMatch(route, /manualOverride/);
  assert.doesNotMatch(route, /recordManualSearchOverrideV1/);
  assert.match(
    route,
    /capabilityAllowsRole\("web_search\.use", permissionRole\)/,
  );
  assert.match(
    route,
    /"x-vs-web-search-authorization": "supabase_fresh_web_search_v1"/,
  );
  assert.match(
    route,
    /fetch\(`\$\{brains\}\/response\/query`,[\s\S]*?automaticSearchAuthorized[\s\S]*?"x-vs-web-search-authorization":\s*"supabase_fresh_web_search_v1"/,
  );
  assert.match(route, /SERVER_SEARCH_AUTHORITY_VERSION/);

  assert.doesNotMatch(pane, /search_override/);
  assert.doesNotMatch(pane, /SearchControl/);
  assert.doesNotMatch(pane, /X-VS-Trusted-Web-Fallback/);
  assert.doesNotMatch(pane, /search_mode:/);
  assert.doesNotMatch(pane, /data-web-mode-selector/);
  assert.doesNotMatch(pane, /canOverrideWebSearch/);
  assert.doesNotMatch(pane, /web_search\.override/);
  assert.doesNotMatch(pane, /"\/api\/trusted-web"/);
  assert.doesNotMatch(pane, /"\/api\/current-news"/);
});
