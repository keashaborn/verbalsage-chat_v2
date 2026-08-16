import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  shell: "app/lifeswitch/layout.tsx",
  topBar: "components/nav/AppTopBar.tsx",
  workflow: "components/lifeswitch/LifeSwitchModeNav.tsx",
  account: "components/nav/AccountMenu.tsx",
  workspace: "components/nav/WorkspaceMenu.tsx",
  standard: "docs/frontend/WEB_DESIGN_STANDARD.md",
};

async function source(name) {
  return readFile(new URL(`../${files[name]}`, import.meta.url), "utf8");
}

test("glass surfaces keep opaque fallbacks", async () => {
  const expected = {
    topBar: ["bg-background/95", "supports-[backdrop-filter]:bg-background/70"],
    workflow: ["bg-card", "supports-[backdrop-filter]:bg-card/80"],
    account: ["bg-popover", "supports-[backdrop-filter]:bg-popover/95"],
    workspace: ["bg-popover", "supports-[backdrop-filter]:bg-popover/95"],
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

  assert.match(await source("shell"), /AppTopBar/);
});

test("global navigation menus use the same dense glass treatment", async () => {
  const account = await source("account");
  const workspace = await source("workspace");

  assert.doesNotMatch(account, /bg-popover\/85/);
  assert.doesNotMatch(workspace, /bg-popover\/85/);
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
