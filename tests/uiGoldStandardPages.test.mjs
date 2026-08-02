import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("People has one quiet workflow navigation across all three routes", () => {
  const nav = read("components/lifeswitch/people/PeopleWorkflowNav.tsx");
  const pages = [
    read("app/lifeswitch/people/page.tsx"),
    read("app/lifeswitch/people/helping/page.tsx"),
    read("app/lifeswitch/people/messages/page.tsx"),
  ];

  assert.match(nav, /label: "Connections"/);
  assert.match(nav, /label: "Shared with me"/);
  assert.match(nav, /label: "Messages"/);
  assert.match(nav, /aria-current=\{active \? "page"/);
  assert.match(nav, /min-h-11/);
  for (const page of pages) {
    assert.match(page, /<PeopleWorkflowNav \/>/);
    assert.match(page, /<h1/);
    assert.doesNotMatch(page, /BackButton/);
  }
});

test("People messages use a flat transcript and reachable primary controls", () => {
  const page = read("app/lifeswitch/people/messages/page.tsx");

  assert.match(page, /border-b border-muted\/20 py-3/);
  assert.doesNotMatch(page, /max-w-\[85%\]/);
  assert.match(page, /New message[\s\S]*min-h-11/);
  assert.match(page, /<textarea/);
});

test("Personalization keeps primary choices visible and advanced choices collapsed", () => {
  const preferences = read("components/settings/AssistantPreferences.tsx");
  const page = read("app/settings/assistant-profile/page.tsx");

  assert.match(preferences, />\s*You\s*</);
  assert.match(preferences, />\s*Responses\s*</);
  assert.match(preferences, /<details[^>]*>[\s\S]*<span>Advanced<\/span>/);
  assert.match(preferences, /label="Technical depth"/);
  assert.match(preferences, /label="Format"/);
  assert.equal((preferences.match(/Save changes/g) || []).length, 1);
  assert.doesNotMatch(page, /description=/);
});

test("Account has one save action and no duplicate authorization summary rows", () => {
  const page = read("app/settings/account/page.tsx");

  assert.equal((page.match(/Save changes/g) || []).length, 1);
  assert.match(page, /saveAccountChanges/);
  assert.doesNotMatch(page, />\s*Sign-in email\s*</);
  assert.doesNotMatch(page, />\s*Product plan\s*</);
  assert.doesNotMatch(page, />\s*Account role\s*</);
});

test("Security and Data & Privacy own distinct controls", () => {
  const securityPage = read("app/settings/security/page.tsx");
  const privacy = read("components/settings/DataPrivacyPanel.tsx");
  const panel = read("components/admin/SecurityPanel.tsx");

  assert.match(securityPage, /<SecurityPanel view="security" \/>/);
  assert.match(privacy, /<SecurityPanel view="data" \/>/);
  assert.match(privacy, /setOpenSection/);
  assert.match(panel, /view\?: SecurityPanelView/);
  assert.match(panel, /title="Password"/);
  assert.match(panel, /title="Sessions"/);
  assert.match(panel, /title="Export"/);
});

test("Admin Console is a controlled one-open-section accordion", () => {
  const page = read("components/admin/settings/AdminConsolePage.tsx");
  const sectionDefinition = page.slice(
    page.indexOf("function AdminSection"),
    page.indexOf("export function AdminConsolePage"),
  );

  assert.doesNotMatch(sectionDefinition, /useState/);
  assert.match(page, /const \[openSection, setOpenSection\]/);
  assert.match(page, /current === id \? null : id/);
  assert.match(page, /aria-expanded=\{open\}/);
  assert.match(page, /hidden=\{!open\}/);
});

test("Voice selectors retain small indicators inside 44 pixel targets", () => {
  const panel = read("components/admin/VoicePanel.tsx");

  assert.match(panel, /grid h-11 w-11 place-items-center/);
  assert.match(panel, /h-2\.5 w-2\.5 rounded-full/);
  assert.doesNotMatch(
    panel,
    /type="button"[\s\S]{0,180}className=\{`h-2\.5 w-2\.5/,
  );
});

test("settings pages use short headers and a reachable Back action", () => {
  const frame = read("components/settings/SettingsPageFrame.tsx");
  const pages = [
    "app/settings/appearance/page.tsx",
    "app/settings/security/page.tsx",
    "app/settings/data-privacy/page.tsx",
    "app/settings/voice/page.tsx",
    "app/admin/page.tsx",
  ];

  assert.match(frame, /min-h-11[\s\S]*← Back/);
  for (const page of pages) assert.doesNotMatch(read(page), /description=/);
});

test("Training and Nutrition Analyze keep dense data with quiet reachable controls", () => {
  const training = read("app/lifeswitch/training/analyze/page.tsx");
  const nutrition = read("app/lifeswitch/nutrition/analyze/page.tsx");

  for (const page of [training, nutrition]) {
    assert.match(page, /<h1 className="text-xl font-semibold">/);
    assert.match(page, /analysisChoiceClassName/);
    assert.match(page, /min-h-11 min-w-11/);
    assert.match(page, /aria-pressed=/);
    assert.match(page, /How this is calculated/);
    assert.doesNotMatch(page, /Read-only .* dashboard/);
  }

  assert.match(training, /id="strength-frequency-title"/);
  assert.match(training, /id="strength-progression-title"/);
  assert.match(training, /className="mt-2 min-h-11 w-full/);
  assert.match(training, /How progression is calculated/);
  assert.doesNotMatch(training, /Select one exercise to graph/);

  assert.match(nutrition, /id="nutrition-adherence-title"/);
  assert.match(nutrition, /id="nutrition-trends-title"/);
  assert.doesNotMatch(nutrition, /One metric across completed logged days/);
});

test("Analyze presentation cleanup preserves its read-only data contracts", () => {
  const training = read("app/lifeswitch/training/analyze/page.tsx");
  const nutrition = read("app/lifeswitch/nutrition/analyze/page.tsx");

  for (const endpoint of [
    "/api/lifeswitch/training/sessions?limit=500",
    "/api/lifeswitch/training/conditioning_sessions?limit=500",
    "/api/lifeswitch/training/progression?",
    "/api/lifeswitch/plan/agentic/active",
    "/api/lifeswitch/plan/agentic/recovery-adjustments",
  ]) {
    assert.match(training, new RegExp(endpoint.replace(/[?]/g, "\\?")));
  }

  for (const endpoint of [
    "/api/lifeswitch/nutrition/log/range",
    "/api/lifeswitch/plan/agentic/active",
    "/api/lifeswitch/plan/profile?create_if_missing=0",
    "/api/lifeswitch/plan/agentic/recovery-adjustments",
  ]) {
    assert.match(nutrition, new RegExp(endpoint.replace(/[?]/g, "\\?")));
  }

  for (const page of [training, nutrition]) {
    assert.doesNotMatch(page, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
  }
});
