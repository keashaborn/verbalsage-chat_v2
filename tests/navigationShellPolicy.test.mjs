import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("primary app surfaces share one top-bar treatment", () => {
  const topBar = read("components/nav/AppTopBar.tsx");
  const surfaces = [
    read("app/assistant.tsx"),
    read("app/lifeswitch/layout.tsx"),
    read("app/collect/layout.tsx"),
    read("components/settings/SettingsPageFrame.tsx"),
  ];

  assert.match(topBar, /sticky top-0/);
  assert.match(topBar, /supports-\[backdrop-filter\]:bg-background\/70/);
  assert.match(topBar, /supports-\[backdrop-filter\]:backdrop-blur-2xl/);

  for (const surface of surfaces) {
    assert.match(surface, /AppTopBar/);
  }
});

test("the document has one ordinary scrolling root", () => {
  const css = read("app/globals.css");

  assert.match(css, /html\s*\{[\s\S]*?min-height:\s*100%/);
  assert.match(css, /body\s*\{[\s\S]*?min-height:\s*100dvh/);
  assert.equal((css.match(/overflow-x:\s*clip/g) || []).length, 2);
  assert.doesNotMatch(css, /overflow-x:\s*hidden/);
  assert.doesNotMatch(css, /html,\s*body\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(
    css,
    /html\.vs-lock-body-scroll,\s*body\.vs-lock-body-scroll\s*\{[\s\S]*?height:\s*100%/,
  );
});

test("mobile workflow navigation remains stable across plan and measurements", () => {
  const nav = read("components/lifeswitch/LifeSwitchModeNav.tsx");

  assert.match(nav, /activeDomain/);
  assert.match(nav, /rememberedDomainFromBrowser/);
  assert.doesNotMatch(nav, /setPlanSection/);
  assert.doesNotMatch(nav, /rawDomain === "measurements"\) return null/);
  assert.match(nav, /data-lifeswitch-mode-nav="mobile"/);
  assert.match(nav, /transform-gpu/);
});

test("dropdowns remain denser than the top navigation surface", () => {
  const workspace = read("components/nav/WorkspaceMenu.tsx");
  const account = read("components/nav/AccountMenu.tsx");

  assert.match(workspace, /supports-\[backdrop-filter\]:bg-popover\/95/);
  assert.match(account, /supports-\[backdrop-filter\]:bg-popover\/95/);
});
