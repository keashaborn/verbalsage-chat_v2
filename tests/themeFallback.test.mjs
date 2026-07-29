import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Mist is the single untouched-account fallback", () => {
  const theme = read("lib/theme.ts");
  const authGate = read("components/auth/AuthGate.tsx");
  const layout = read("app/layout.tsx");
  const standard = read("docs/frontend/WEB_DESIGN_STANDARD.md");

  assert.match(theme, /DEFAULT_THEME: VSTheme = "mist"/);
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
    /Mist is the fallback theme for accounts without a saved preference/,
  );
});

test("saved theme values still take precedence over the fallback", () => {
  const authGate = read("components/auth/AuthGate.tsx");
  assert.match(
    authGate,
    /applyTheme\(cloudTheme \|\| localTheme \|\| DEFAULT_THEME\)/,
  );
});
