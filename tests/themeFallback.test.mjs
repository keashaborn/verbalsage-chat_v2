import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Balanced is the single untouched-account fallback", () => {
  const theme = read("lib/theme.ts");
  const authGate = read("components/auth/AuthGate.tsx");
  const layout = read("app/layout.tsx");
  const standard = read("docs/frontend/WEB_DESIGN_STANDARD.md");

  assert.match(theme, /DEFAULT_THEME: VSTheme = "balanced"/);
  assert.match(
    authGate,
    /applyTheme\(cloudTheme \|\| localTheme \|\| DEFAULT_THEME\)/,
  );
  assert.doesNotMatch(
    authGate,
    /applyTheme\(cloudTheme \|\| localTheme \|\| "graphite"\)/,
  );
  assert.match(layout, /import { DEFAULT_THEME } from "@\/lib\/theme"/);
  assert.match(layout, /className={DEFAULT_THEME}/);
  assert.match(layout, /data-theme={DEFAULT_THEME}/);
  assert.equal(
    (layout.match(/\${JSON\.stringify\(DEFAULT_THEME\)}/g) || []).length,
    2,
  );
  assert.match(
    standard,
    /Balanced is the fallback theme for accounts without a saved preference/,
  );
});

test("appearance retains one balanced, one light, and one dark choice", () => {
  const theme = read("lib/theme.ts");
  const appearance = read("components/admin/PersonalizationPanel.tsx");

  assert.match(theme, /export type VSTheme = "balanced" \| "mist" \| "slate"/);
  assert.match(appearance, /<option value="balanced">Balanced<\/option>/);
  assert.match(appearance, /<option value="mist">Light<\/option>/);
  assert.match(appearance, /<option value="slate">Dark<\/option>/);
  assert.doesNotMatch(appearance, /label: "(?:Paper|Graphite|Carbon)"/);
});

test("saved theme values still take precedence over the fallback", () => {
  const authGate = read("components/auth/AuthGate.tsx");
  assert.match(
    authGate,
    /applyTheme\(cloudTheme \|\| localTheme \|\| DEFAULT_THEME\)/,
  );
});
