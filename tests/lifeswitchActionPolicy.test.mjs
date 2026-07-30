import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function sourceFiles(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  return fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

test("LifeSwitch no longer mounts a universal page helper", () => {
  const layout = read("app/lifeswitch/layout.tsx");
  assert.doesNotMatch(layout, /LifeSwitchHelper/);
  assert.match(layout, /ConfirmActionProvider/);
});

test("LifeSwitch actions use the shared confirmation surface", () => {
  const files = [
    ...sourceFiles("app/lifeswitch"),
    ...sourceFiles("components/lifeswitch"),
  ];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /\b(?:window\.)?confirm\s*\(/,
      `${path.relative(root, file)} uses a native browser confirmation`,
    );
    assert.doesNotMatch(
      source,
      /Danger zone/i,
      `${path.relative(root, file)} contains a persistent danger-zone treatment`,
    );
  }
});

test("shared confirmation defaults focus to cancellation", () => {
  const provider = read("components/lifeswitch/ConfirmActionProvider.tsx");
  assert.match(provider, /@radix-ui\/react-dialog/);
  assert.match(provider, />\s*Cancel\s*</);
  assert.match(provider, /autoFocus/);
});
