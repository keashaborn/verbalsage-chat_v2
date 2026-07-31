import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("AI Operations read BFF derives fresh authority and forwards inspector context", () => {
  const shared = source("app/api/admin/ai-operations/_shared.ts");
  const route = source("app/api/admin/ai-operations/incidents/route.ts");

  assert.match(shared, /requireFreshCapability\(req, capability\)/);
  assert.match(shared, /capability: "inspector\.view" \| "incident\.manage"/);
  assert.match(shared, /auth\.auth\?\.user_id/);
  assert.match(shared, /"x-vs-authorized-capability": "inspector\.view"/);
  assert.match(shared, /brainsUpstreamHeaders\(correlationId, actorUserId/);
  assert.match(shared, /Cache-Control/);
  assert.match(shared, /no-store/);
  assert.match(route, /\/admin\/ai-operations\/incidents\?/);
  assert.doesNotMatch(shared, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(route, /actor_user_id/);
});

test("AI Operations management is capability-bound and body-free", () => {
  const shared = source("app/api/admin/ai-operations/_shared.ts");
  const acknowledge = source(
    "app/api/admin/ai-operations/incidents/[incidentId]/acknowledge/route.ts",
  );
  const resolve = source(
    "app/api/admin/ai-operations/incidents/[incidentId]/resolve/route.ts",
  );
  const registry = source(
    "components/admin/settings/permissions/permissionRegistry.ts",
  );

  assert.match(shared, /"incident\.manage"/);
  assert.ok(
    shared.indexOf('"incident.manage"') < shared.indexOf("req.body !== null"),
    "authorization must precede request validation",
  );
  assert.match(shared, /req\.body !== null/);
  assert.match(shared, /unexpected_request_body/);
  assert.match(shared, /method: "POST"/);
  assert.match(shared, /admin_ai_operations_mutation_v1/);
  assert.match(shared, /ai_operations_monitor_mutation_v1/);
  assert.match(
    acknowledge,
    /mutateAiOperationsIncident\(req, incidentId, "acknowledge"\)/,
  );
  assert.match(
    resolve,
    /mutateAiOperationsIncident\(req, incidentId, "resolve"\)/,
  );
  assert.doesNotMatch(acknowledge, /req\.json|actor_user_id/);
  assert.doesNotMatch(resolve, /req\.json|actor_user_id/);
  assert.match(registry, /key: "incident\.manage"/);
  assert.match(registry, /defaultRoles: \["owner", "admin"\]/);
});

test("AI Operations BFF bounds and validates metadata-only contracts", () => {
  const shared = source("app/api/admin/ai-operations/_shared.ts");
  const route = source("app/api/admin/ai-operations/incidents/route.ts");

  assert.match(shared, /MAX_LIMIT = 100/);
  assert.match(shared, /admin_ai_operations_incidents_v1/);
  assert.match(shared, /ai_operations_monitor_inbox_v1/);
  assert.match(shared, /INCIDENT_KEYS/);
  assert.match(shared, /reason_codes/);
  assert.match(route, /invalid_ai_operations_query/);
  assert.match(route, /ai_operations_unavailable/);
  assert.doesNotMatch(
    shared,
    /source_url|query_sha256|response_body|prompt_text/,
  );
});

test("AI Operations stays separate and uses deliberate authoritative actions", () => {
  const page = source("components/admin/settings/AdminConsolePage.tsx");
  const panel = source("components/admin/settings/AiOperationsPanel.tsx");
  const aiOperationsIndex = page.indexOf('title="AI Operations"');
  const usageIndex = page.indexOf('title="Usage & Analytics"');

  assert.notEqual(aiOperationsIndex, -1);
  assert.notEqual(usageIndex, -1);
  assert.ok(aiOperationsIndex < usageIndex);
  assert.match(page, /<AiOperationsPanel \/>/);
  assert.match(page, /Private reliability incidents/);
  assert.match(panel, /Private operational metadata only/);
  assert.match(panel, /Prompts, queries, URLs/);
  assert.match(panel, /Safe drill/);
  assert.match(panel, /Confirm resolve/);
  assert.match(panel, /await load\(\)/);
  assert.match(panel, /method: "POST"/);
  assert.doesNotMatch(panel, /actor_user_id/);
});
