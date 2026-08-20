import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("unused catalog BFF routes remain retired", () => {
  for (const relative of [
    "app/api/catalog/foods/search/route.ts",
    "app/api/catalog/foods/usda/search/route.ts",
  ]) {
    assert.equal(fs.existsSync(path.join(root, relative)), false, relative);
  }
});

test("named LifeSwitch catalog BFF routes remain present", () => {
  for (const relative of [
    "app/api/catalog/exercises/search/route.ts",
    "app/api/catalog/exercises/browse/route.ts",
    "app/api/catalog/foods/usda/guide/route.ts",
    "app/api/catalog/foods/usda/barcode/route.ts",
  ]) {
    assert.equal(fs.existsSync(path.join(root, relative)), true, relative);
  }
});
