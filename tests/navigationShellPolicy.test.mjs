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
  assert.doesNotMatch(css, /overflow-x:\s*(?:hidden|clip)/);
  assert.doesNotMatch(css, /html,\s*body\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(
    css,
    /html\.vs-lock-body-scroll,\s*body\.vs-lock-body-scroll\s*\{[\s\S]*?height:\s*100%/,
  );
  assert.doesNotMatch(
    css,
    /data-lifeswitch-helper-open/,
    "retired page helper must not retain global navigation overrides",
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

test("chat flex boundaries cannot grow wider than the viewport", () => {
  const sidebar = read("components/ui/sidebar.tsx");
  const assistant = read("app/assistant.tsx");
  const chat = read("components/threads/BrainsChatPane.tsx");

  assert.match(
    sidebar,
    /group\/sidebar-wrapper flex min-h-svh w-full max-w-full min-w-0/,
  );
  assert.match(
    sidebar,
    /relative flex max-w-full min-w-0 flex-1 flex-col bg-background/,
  );
  assert.doesNotMatch(
    sidebar,
    /relative flex w-full flex-1 flex-col bg-background/,
  );
  assert.match(
    assistant,
    /flex h-dvh w-full max-w-full min-w-0 overflow-hidden/,
  );
  assert.match(assistant, /max-w-full min-w-0 flex-1 overflow-hidden/);
  assert.match(
    chat,
    /relative flex h-full max-w-full min-w-0 flex-col overflow-hidden/,
  );
  assert.match(chat, /sticky bottom-0 z-10 max-w-full min-w-0/);
});
