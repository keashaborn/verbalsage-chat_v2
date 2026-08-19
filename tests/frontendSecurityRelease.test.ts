import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("production dependency floors cover audited findings and unused AI SDK code is retired", () => {
  const manifest = JSON.parse(source("package.json"));

  assert.equal(manifest.dependencies.next, "16.2.12");
  assert.equal(manifest.dependencies["@rjsf/core"], "6.7.1");
  assert.equal(manifest.dependencies["@rjsf/validator-ajv8"], "6.7.1");
  assert.equal(manifest.dependencies["@supabase/supabase-js"], "2.110.9");
  assert.equal(manifest.devDependencies["@next/eslint-plugin-next"], "16.2.12");
  assert.equal(manifest.devDependencies["eslint-config-next"], undefined);
  assert.equal(manifest.devDependencies["typescript-eslint"], "8.65.0");
  assert.equal(manifest.devDependencies.eslint, "10.8.0");
  assert.equal(manifest.devDependencies["eslint-plugin-react-hooks"], "7.1.1");
  assert.equal(manifest.devDependencies["@eslint/eslintrc"], undefined);
  assert.equal(manifest.overrides.postcss, "8.5.23");
  assert.equal(manifest.overrides.sharp, "0.35.3");
  assert.equal(manifest.overrides["fast-uri@^3.0.1"], "3.1.5");
  assert.equal(manifest.overrides["fast-uri@^4.0.0"], "4.1.2");
  assert.equal(manifest.overrides["nanoid@^3.3.16"], "3.3.18");
  assert.equal(manifest.overrides["nanoid@^5.1.6"], "5.1.16");
  assert.equal(manifest.dependencies.ai, undefined);
  assert.equal(manifest.dependencies["@ai-sdk/openai"], undefined);
  assert.equal(manifest.dependencies["@assistant-ui/react-ai-sdk"], undefined);
  assert.doesNotMatch(source("app/assistant.tsx"), /TextStreamChatTransport/);
  assert.doesNotMatch(source("app/assistant.tsx"), /AssistantRuntimeProvider/);
  assert.match(manifest.scripts.lint, /^eslint /);
  assert.doesNotMatch(source("eslint.config.mjs"), /FlatCompat/);
  assert.match(source("eslint.config.mjs"), /@next\/eslint-plugin-next/);
  assert.match(source("eslint.config.mjs"), /typescript-eslint/);
  assert.match(source("eslint.config.mjs"), /react-hooks\/rules-of-hooks/);
  assert.match(source("eslint.config.mjs"), /react-hooks\/exhaustive-deps/);
});

test("production builds emit a standalone immutable release artifact", () => {
  const config = source("next.config.ts");

  assert.match(config, /output:\s*["']standalone["']/);
  assert.doesNotMatch(config, /output:\s*["']export["']/);
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

  assert.match(
    proxy,
    /NextResponse\.next\(\{[\s\S]*request:\s*\{\s*headers:\s*requestHeaders\s*\}/,
  );
  assert.match(proxy, /withSecurityHeaders\(nextResponse\)/);
  assert.match(
    proxy,
    /withSecurityHeaders\(\s*new NextResponse\(null,[\s\S]*status: 204/,
  );
});

test("proxy derives site identity from an allowlisted host and overwrites assertions", () => {
  const proxy = source("proxy.ts");
  const policy = source("lib/siteBrand.ts");

  assert.match(proxy, /resolveSiteHost\(req\.headers\.get\("host"\)\)/);
  assert.match(proxy, /status:\s*421/);
  assert.match(proxy, /requestHeaders\.set\(SITE_HEADER, host\.siteId\)/);
  assert.match(proxy, /classifySiteRequest/);
  assert.match(proxy, /status:\s*404/);
  assert.match(proxy, /NextResponse\.redirect\(lifeSwitchUrl, 308\)/);
  assert.match(policy, /"verbalsage\.com":\s*"verbal-sage"/);
  assert.match(policy, /"lifeswitch\.com":\s*"lifeswitch"/);
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
  assert.match(
    proxy,
    /connect-src 'self' https:\/\/challenges\.cloudflare\.com/,
  );
  assert.match(proxy, /frame-src https:\/\/challenges\.cloudflare\.com/);
  assert.match(proxy, /camera=\(self\), microphone=\(self\)/);
  assert.doesNotMatch(proxy, /unsafe-eval/);
  assert.doesNotMatch(proxy, /script-src[^"\n]*\*/);
  assert.doesNotMatch(proxy, /connect-src[^"\n]*\*/);
});
