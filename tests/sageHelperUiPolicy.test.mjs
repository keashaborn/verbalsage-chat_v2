import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const helperUrl = new URL(
  "../components/lifeswitch/helper/LifeSwitchHelper.tsx",
  import.meta.url,
);
const globalsUrl = new URL("../app/globals.css", import.meta.url);

test("phone Sage Helper is a focused full-screen workspace", async () => {
  const helper = await readFile(helperUrl, "utf8");
  const globals = await readFile(globalsUrl, "utf8");

  assert.match(helper, /createPortal/);
  assert.match(helper, /role="dialog"/);
  assert.match(helper, /aria-modal="true"/);
  assert.match(helper, /fixed inset-0 z-\[100\]/);
  assert.match(helper, /h-dvh w-screen/);
  assert.match(helper, /dataset\.lifeswitchHelperOpen = "true"/);
  assert.match(globals, /data-lifeswitch-helper-open="true"/);
  assert.match(globals, /\[data-lifeswitch-mode-nav\]/);
});

test("Sage Helper removes competing decoration and duplicate copy", async () => {
  const helper = await readFile(helperUrl, "utf8");

  assert.match(helper, /Ask about this page\./);
  assert.match(helper, /placeholder="Ask about this page…"/);
  assert.doesNotMatch(helper, /Speech uses an AI-generated voice\./);
  assert.doesNotMatch(helper, /supports-\[backdrop-filter\]/);
  assert.doesNotMatch(helper, /rounded-xl px-3 py-2 text-sm leading-snug/);
});

test("Sage Helper closes cleanly on navigation and Escape", async () => {
  const helper = await readFile(helperUrl, "utf8");

  assert.match(helper, /previousPathnameRef\.current !== pathname/);
  assert.match(helper, /event\.key === "Escape"/);
  assert.match(helper, /triggerRef\.current\?\.focus\(\)/);
});
