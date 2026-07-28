import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("dormant Vantage settings surfaces are absent", () => {
  for (const relativePath of [
    "components/admin/SettingsDrawer.tsx",
    "components/admin/settings/VantageProfilePage.tsx",
    "components/admin/settings/VantagePersonalizationEditor.tsx",
    "components/sslg/SSLGModalLauncher.tsx",
    "app/developer/diagnostics/page.tsx",
    "app/api/dev/models/route.ts",
  ]) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false);
  }
});

test("retired model diagnostics are absent from the Admin Console", () => {
  const adminConsole = source("components/admin/settings/AdminConsolePage.tsx");
  const permissions = source(
    "components/admin/settings/permissions/permissionRegistry.ts",
  );

  assert.doesNotMatch(adminConsole, /Model Diagnostics|developer\/diagnostics/);
  assert.doesNotMatch(permissions, /diagnostics\.run/);
  assert.match(adminConsole, /VoiceSystemHealthPanel/);
  assert.match(adminConsole, /title="Voice Health"/);
  assert.match(adminConsole, /title="Response Diagnostics"/);
  assert.match(adminConsole, /Response trace/);
  assert.doesNotMatch(adminConsole, /Prompt Inspector/);
  assert.doesNotMatch(permissions, /assistant_profile/);
});

test("active authentication and settings code do not hydrate Vantage controls", () => {
  const activeSource = [
    source("components/auth/AuthGate.tsx"),
    source("components/admin/settings/store.tsx"),
  ].join("\n");

  assert.doesNotMatch(activeSource, /vs_vantage_/);
  assert.doesNotMatch(activeSource, /lens_fm|memory_cards|pragmatics|roleplay/);
  assert.match(activeSource, /vs_model/);
  assert.match(activeSource, /vs_theme/);
});

test("ordinary chat remains independent of legacy Vantage controls", () => {
  const chat = source("app/api/chat/route.ts");
  assert.doesNotMatch(
    chat,
    /vs_vantage_|lens_fm|memory_cards|pragmatics|roleplay/,
  );
  assert.match(chat, /response\/query/);
});

test("legacy diagnostics remain explicitly quarantined for RAG evaluation", () => {
  const diagnosticRoute = source("app/api/chat/inspect/route.ts");
  assert.match(diagnosticRoute, /Legacy diagnostic defaults/);
  assert.match(diagnosticRoute, /vantage\/query/);
});
