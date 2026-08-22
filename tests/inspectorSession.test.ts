import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INSPECTOR_SESSION_MAX_AGE_SECONDS,
  inspectorSessionCookie,
  inspectorSessionCookieName,
  inspectorSessionEnabled,
  retiredInspectorCookieDeletion,
} from "../lib/inspectorSession.ts";

const adminConsoleSource = readFileSync(
  new URL("../components/admin/settings/AdminConsolePage.tsx", import.meta.url),
  "utf8",
);
const inspectorRouteSource = readFileSync(
  new URL("../app/api/admin/inspector-session/route.ts", import.meta.url),
  "utf8",
);

test("the inspector enablement flag is exact and non-secret", () => {
  assert.equal(inspectorSessionEnabled("1"), true);
  assert.equal(inspectorSessionEnabled("true"), false);
  assert.equal(inspectorSessionEnabled("shared-secret"), false);
  assert.equal(inspectorSessionEnabled(undefined), false);
});

test("production inspector cookie is host-bound and inaccessible to JavaScript", () => {
  const cookie = inspectorSessionCookie(true, true);

  assert.equal(
    inspectorSessionCookieName(true),
    "__Host-vs_inspector_enabled",
  );
  assert.match(cookie, /^__Host-vs_inspector_enabled=1;/);
  assert.match(cookie, /Max-Age=21600/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(cookie, /VS_DEBUG_TOKEN|vs_debug_token/);
  assert.equal(INSPECTOR_SESSION_MAX_AGE_SECONDS, 21_600);
});

test("cookie deletion preserves the security attributes", () => {
  const cookie = inspectorSessionCookie(false, true);

  assert.match(cookie, /^__Host-vs_inspector_enabled=;/);
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
});

test("the retired shared-secret cookie is actively deleted", () => {
  const cookie = retiredInspectorCookieDeletion(true);

  assert.match(cookie, /^vs_debug_token=;/);
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
});

test("development uses a non-prefixed cookie without weakening server authorization", () => {
  const cookie = inspectorSessionCookie(true, false);

  assert.equal(inspectorSessionCookieName(false), "vs_inspector_enabled");
  assert.match(cookie, /^vs_inspector_enabled=1;/);
  assert.doesNotMatch(cookie, /Secure/);
});

test("admin uses the capability-named inspector session boundary", () => {
  assert.equal(
    adminConsoleSource.match(/\/api\/admin\/inspector-session/g)?.length,
    3,
  );
  assert.doesNotMatch(adminConsoleSource, /\/api\/admin\/debug_cookie/);
  assert.match(
    inspectorRouteSource,
    /requireFreshCapability\(req, "inspector\.view"\)/,
  );
  assert.doesNotMatch(inspectorRouteSource, /VS_DEBUG_TOKEN|vs_debug_token/);
});
