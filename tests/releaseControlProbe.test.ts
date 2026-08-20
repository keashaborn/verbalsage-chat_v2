import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/api/internal/release-probe/route.ts"),
  "utf8",
);

test("release probe is server-token authenticated and content-free", () => {
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /x-lifeswitch-release-control/);
  assert.match(source, /VS_SERVICE_TOKEN/);
  assert.match(source, /status:\s*401/);
  assert.match(
    source,
    /\{ ok: true, frontend: true, backend: true, postgres: true \}/,
  );
  assert.doesNotMatch(source, /SUPABASE_SECRET_KEY|OPENAI_API_KEY|ZEP_API_KEY/);
});

test("release probe verifies the exact backend readiness contract", () => {
  assert.match(source, /fetch\(`\$\{brainsUrl\}\/readyz`/);
  assert.match(source, /"x-vs-service-token": expected/);
  assert.match(source, /AbortSignal\.timeout\(5000\)/);
  assert.match(source, /MAX_UPSTREAM_BYTES = 1024/);
  assert.match(source, /Object\.keys\(value\)\.sort\(\)\.join\(","\) !== "ok,postgres"/);
  assert.match(source, /status:\s*503/);
});

test("release probe responses are never cacheable", () => {
  assert.match(source, /private, no-store, max-age=0, must-revalidate/);
  assert.match(source, /x-content-type-options/);
  assert.match(source, /x-request-id/);
});
