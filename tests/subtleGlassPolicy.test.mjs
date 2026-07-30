import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  shell: "app/lifeswitch/layout.tsx",
  workflow: "components/lifeswitch/LifeSwitchModeNav.tsx",
  helper: "components/lifeswitch/helper/LifeSwitchHelper.tsx",
  account: "components/nav/AccountMenu.tsx",
  workspace: "components/nav/WorkspaceMenu.tsx",
  standard: "docs/frontend/WEB_DESIGN_STANDARD.md",
};

async function source(name) {
  return readFile(new URL(`../${files[name]}`, import.meta.url), "utf8");
}

test("glass surfaces keep opaque fallbacks", async () => {
  const expected = {
    shell: ["bg-background", "supports-[backdrop-filter]:bg-background/80"],
    workflow: ["bg-card", "supports-[backdrop-filter]:bg-card/80"],
    helper: ["bg-background", "supports-[backdrop-filter]:bg-background/85"],
    account: ["bg-popover", "supports-[backdrop-filter]:bg-popover/85"],
    workspace: ["bg-popover", "supports-[backdrop-filter]:bg-popover/85"],
  };

  for (const [name, classes] of Object.entries(expected)) {
    const text = await source(name);
    for (const className of classes) {
      assert.match(
        text,
        new RegExp(className.replaceAll("[", "\\[").replaceAll("]", "\\]")),
        `${files[name]} should include ${className}`,
      );
    }
  }
});

test("glass remains limited to elevated shared surfaces", async () => {
  const standard = await source("standard");

  assert.match(standard, /Use restrained translucency only/);
  assert.match(standard, /opaque theme-token fallback/);
  assert.match(
    standard,
    /Do not apply glass styling to lists, forms, capture rows, calendars/,
  );
});
