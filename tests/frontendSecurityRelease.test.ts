import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("production dependency floors cover the audited high and moderate findings", () => {
  const manifest = JSON.parse(source("package.json"));

  assert.equal(manifest.dependencies.next, "16.2.12");
  assert.equal(manifest.dependencies["@rjsf/core"], "6.7.1");
  assert.equal(manifest.dependencies["@rjsf/validator-ajv8"], "6.7.1");
  assert.equal(manifest.dependencies["@supabase/supabase-js"], "2.110.9");
  assert.equal(manifest.devDependencies["eslint-config-next"], "16.2.12");
  assert.equal(manifest.overrides.postcss, "8.5.23");
  assert.equal(manifest.overrides.sharp, "0.35.3");
});

test("proxy applies browser hardening headers to normal and rejected requests", () => {
  const proxy = source("proxy.ts");

  for (const header of [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Cross-Origin-Resource-Policy",
  ]) {
    assert.match(proxy, new RegExp(header));
  }

  assert.match(proxy, /withSecurityHeaders\(\s*NextResponse\.next\(\)\s*\)/);
  assert.match(
    proxy,
    /withSecurityHeaders\(\s*new NextResponse\(null,[\s\S]*status: 204/,
  );
});

test("CSP is restrictive while preserving required LifeSwitch capabilities", () => {
  const proxy = source("proxy.ts");

  for (const directive of [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "connect-src 'self'",
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ]) {
    assert.match(
      proxy,
      new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }

  assert.match(proxy, /https:\/\/shvuircoviuuijthoqji\.supabase\.co/);
  assert.match(proxy, /wss:\/\/shvuircoviuuijthoqji\.supabase\.co/);
  assert.match(proxy, /https:\/\/challenges\.cloudflare\.com/);
  assert.match(proxy, /frame-src https:\/\/challenges\.cloudflare\.com/);
  assert.match(proxy, /camera=\(self\), microphone=\(self\)/);
  assert.doesNotMatch(proxy, /unsafe-eval/);
  assert.doesNotMatch(proxy, /script-src[^"\n]*\*/);
  assert.doesNotMatch(proxy, /connect-src[^"\n]*\*/);
});
