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

test("measurements is standalone while training and nutrition retain workflow navigation", () => {
  const nav = read("components/lifeswitch/LifeSwitchModeNav.tsx");
  const routeChrome = read("components/lifeswitch/LifeSwitchRouteChrome.tsx");
  const layout = read("app/lifeswitch/layout.tsx");

  assert.match(nav, /activeDomain/);
  assert.match(nav, /rememberedDomainFromBrowser/);
  assert.doesNotMatch(nav, /setPlanSection/);
  assert.match(nav, /data-lifeswitch-mode-nav="mobile"/);
  assert.match(nav, /transform-gpu/);
  assert.match(
    routeChrome,
    /\^\\\/lifeswitch\\\/measurements\(\?:\\\/\|\$\)\//,
  );
  assert.match(
    routeChrome,
    /measurementsStandalone \? null : <LifeSwitchModeNav \/>/,
  );
  assert.match(routeChrome, /measurementsStandalone[\s\S]*?"pb-10"/);
  assert.match(
    routeChrome,
    /pb-\[calc\(7rem\+env\(safe-area-inset-bottom\)\)\] md:pb-10/,
  );
  assert.match(
    layout,
    /<LifeSwitchRouteChrome>\{children\}<\/LifeSwitchRouteChrome>/,
  );
  assert.doesNotMatch(layout, /<LifeSwitchModeNav \/>/);
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

test("chat exposes its active title and keyboard landmarks", () => {
  const assistant = read("app/assistant.tsx");
  const title = read("components/threads/ActiveConversationTitle.tsx");
  const chat = read("components/threads/BrainsChatPane.tsx");

  assert.match(assistant, /href="#chat-conversation"/);
  assert.match(assistant, /href="#chat-composer"/);
  assert.match(assistant, /ActiveConversationTitle/);
  assert.match(title, /vs_active_thread_metadata/);
  assert.match(title, /aria-live="polite"/);
  assert.match(chat, /id="chat-conversation"/);
  assert.match(chat, /id="chat-composer"/);
});

test("chat tables scroll locally and message/source styling stays restrained", () => {
  const markdown = read("components/shared/MarkdownMessage.tsx");
  const chat = read("components/threads/BrainsChatPane.tsx");

  assert.match(markdown, /overflow-x-auto/);
  assert.match(markdown, /min-w-\[34rem\]/);
  assert.match(markdown, /border-r border-b/);
  assert.match(chat, /data-message-role=\{m\.role\}/);
  assert.match(chat, /border-r-2 border-foreground\/35/);
  assert.doesNotMatch(chat, /rounded-xl bg-muted px-4 py-2 text-sm/);
  assert.match(chat, /Sources · \{trustedWebSourceSummary/);
  assert.match(chat, /group-open:rotate-180/);
  assert.match(chat, /size-11[\s\S]*sm:size-8/);
});
