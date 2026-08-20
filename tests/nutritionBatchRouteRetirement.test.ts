import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

test("legacy nontransactional nutrition batch proxy remains retired", () => {
  assert.equal(
    existsSync(
      join(root, "app/api/lifeswitch/nutrition/log/entries/route.ts"),
    ),
    false,
  );
});

test("nutrition capture uses only the canonical atomic batch route", () => {
  const capture = source(
    "components/lifeswitch/nutrition/NutritionCapturePage.tsx",
  );
  const proxy = source(
    "app/api/lifeswitch/nutrition/log/entries/batch/route.ts",
  );

  assert.match(
    capture,
    /\/api\/lifeswitch\/nutrition\/log\/entries\/batch/,
  );
  assert.match(
    proxy,
    /\/lifeswitch\/nutrition\/log\/entries\/batch/,
  );
  assert.doesNotMatch(proxy, /\/lifeswitch\/nutrition\/log\/entries["`]/);
});
