import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("access requests require bounded server-side Turnstile verification", () => {
  const route = source("app/api/access-requests/route.ts");
  const verifier = source("lib/turnstile.ts");

  assert.match(route, /verifyAccessRequestTurnstile/);
  assert.match(route, /turnstile_token/);
  assert.match(route, /turnstileToken\.length > 2_048/);
  assert.match(route, /access_request_verification_failed/);
  assert.match(route, /access_request_turnstile_rejected_v1/);
  const postHandler = route.slice(route.indexOf("export async function POST"));
  assert.ok(
    postHandler.indexOf("networkRateLimited") <
      postHandler.indexOf("await verifyAccessRequestTurnstile"),
    "network throttling must protect the external verifier",
  );
  assert.ok(
    postHandler.indexOf("await verifyAccessRequestTurnstile") <
      postHandler.indexOf("emailRateLimited"),
    "invalid bot tokens must not consume a legitimate email quota",
  );
  assert.ok(
    postHandler.indexOf("emailRateLimited") <
      postHandler.indexOf("await persistAccessRequest"),
    "email throttling must run before persistence",
  );

  assert.match(verifier, /import "server-only"/);
  assert.match(verifier, /process\.env\.TURNSTILE_SECRET_KEY/);
  assert.match(
    verifier,
    /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/,
  );
  assert.match(verifier, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/);
  assert.match(verifier, /idempotency_key/);
  assert.match(verifier, /EXPECTED_ACTION = "request_access"/);
  for (const hostname of [
    "lifeswitch.com",
    "www.lifeswitch.com",
    "verbalsage.com",
    "www.verbalsage.com",
  ]) {
    assert.match(verifier, new RegExp(hostname.replaceAll(".", "\\.")));
  }
  assert.doesNotMatch(verifier, /NEXT_PUBLIC_TURNSTILE_SECRET/);
  assert.doesNotMatch(verifier, /console\./);
});

test("public access, login, and password reset flows use single-use Turnstile tokens", () => {
  const widget = source("components/auth/TurnstileWidget.tsx");
  const gate = source("components/auth/AuthGate.tsx");
  const relationshipInvite = source("app/invite/lifeswitch/[token]/page.tsx");
  const securityPanel = source("components/admin/SecurityPanel.tsx");

  assert.match(widget, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  assert.match(
    widget,
    /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/,
  );
  assert.match(widget, /action: TurnstileAction/);
  assert.match(widget, /action,/);
  for (const action of ["auth_login", "password_reset", "request_access"]) {
    assert.match(widget, new RegExp(`"${action}"`));
  }
  assert.match(widget, /"expired-callback"/);
  assert.match(widget, /"timeout-callback"/);
  assert.match(widget, /"error-callback"/);
  assert.match(widget, /window\.turnstile\.reset/);
  assert.doesNotMatch(widget, /TURNSTILE_SECRET_KEY/);

  for (const client of [gate, relationshipInvite]) {
    assert.match(client, /<TurnstileWidget/);
    assert.match(client, /action="auth_login"/);
    assert.match(client, /options: \{ captchaToken: loginToken \}/);
    assert.match(client, /loginTurnstileRef\.current\?\.reset\(\)/);
    assert.match(client, /action="request_access"/);
    assert.match(client, /turnstile_token: accessRequestToken/);
    assert.match(client, /accessRequestTurnstileRef\.current\?\.reset\(\)/);
    assert.match(client, /access_request_verification_failed/);
    assert.match(client, /mode === "request" && !accessRequestToken/);
  }

  assert.match(securityPanel, /action="password_reset"/);
  assert.match(securityPanel, /captchaToken: passwordResetToken/);
  assert.match(
    securityPanel,
    /passwordResetTurnstileRef\.current\?\.reset\(\)/,
  );
  assert.doesNotMatch(
    gate + relationshipInvite + securityPanel,
    /TURNSTILE_SECRET_KEY/,
  );
});

test("CSP permits only the required Turnstile script and frame origin", () => {
  const proxy = source("proxy.ts");

  assert.match(
    proxy,
    /script-src 'self' 'unsafe-inline' https:\/\/challenges\.cloudflare\.com/,
  );
  assert.match(proxy, /frame-src https:\/\/challenges\.cloudflare\.com/);
  assert.doesNotMatch(proxy, /script-src[^"\n]*\*/);
  assert.doesNotMatch(proxy, /frame-src[^"\n]*\*/);
});
