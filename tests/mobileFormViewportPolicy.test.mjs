import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const globals = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

test("LifeSwitch mobile form controls prevent iOS focus zoom", () => {
  assert.match(
    globals,
    /@media \(max-width: 767px\)[\s\S]*?\[data-lifeswitch-root\][\s\S]*?input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)[\s\S]*?select,[\s\S]*?textarea[\s\S]*?font-size:\s*16px;/,
  );
});
