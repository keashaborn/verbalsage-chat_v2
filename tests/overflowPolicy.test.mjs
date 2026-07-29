import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the document shell does not conceal horizontal overflow", () => {
  const globals = read("app/globals.css");
  const documentRule = globals.match(/html,\s*body\s*\{[^}]*\}/s);

  assert.ok(documentRule, "expected the shared html/body sizing rule");
  assert.doesNotMatch(
    documentRule[0],
    /overflow-x:\s*(?:hidden|clip)/,
    "global overflow suppression hides responsive layout defects",
  );
});

test("the LifeSwitch shell leaves horizontal geometry visible", () => {
  const layout = read("app/lifeswitch/layout.tsx");
  const rootClass = layout.match(/data-lifeswitch-root className="([^"]+)"/);
  const mainClass = layout.match(/<main className="([^"]+)"/);

  assert.ok(rootClass, "expected the LifeSwitch root class");
  assert.ok(mainClass, "expected the LifeSwitch main class");
  assert.doesNotMatch(
    rootClass[1],
    /overflow-x-(?:hidden|clip)/,
    "the LifeSwitch root must not mask horizontal overflow",
  );
  assert.doesNotMatch(
    mainClass[1],
    /overflow-x-(?:hidden|clip)/,
    "the LifeSwitch main region must not mask horizontal overflow",
  );
});

test("full-page LifeSwitch surfaces do not reinstate overflow masks", () => {
  const obsoleteRootClasses = [
    [
      "app/lifeswitch/behavior/analyze/page.tsx",
      "mx-auto max-w-5xl p-4 overflow-x-hidden",
    ],
    [
      "app/lifeswitch/behavior/design/measures/page.tsx",
      "mx-auto max-w-5xl p-4 overflow-x-hidden",
    ],
    [
      "app/lifeswitch/nutrition/analyze/page.tsx",
      "mx-auto max-w-6xl p-4 overflow-x-hidden",
    ],
    [
      "app/lifeswitch/people/messages/page.tsx",
      "grid max-w-full min-w-0 gap-4 overflow-x-hidden",
    ],
    [
      "app/lifeswitch/training/analyze/page.tsx",
      "mx-auto max-w-6xl p-4 overflow-x-hidden",
    ],
    [
      "app/lifeswitch/verbal/analyze/page.tsx",
      "mx-auto max-w-5xl p-4 overflow-x-hidden",
    ],
    [
      "components/lifeswitch/nutrition/FoodsPage.tsx",
      "mx-auto max-w-5xl p-4 overflow-x-hidden",
    ],
    [
      "components/lifeswitch/training/ConditioningPage.tsx",
      "mx-auto w-full max-w-6xl overflow-x-hidden p-4",
    ],
    [
      "components/lifeswitch/training/WorkoutsPage.tsx",
      "w-full min-w-0 overflow-x-hidden",
    ],
    [
      "components/lifeswitch/plan/PlanDraftWorkspace.tsx",
      "mx-auto flex min-h-full w-full max-w-3xl min-w-0 flex-col overflow-x-hidden",
    ],
    [
      "components/lifeswitch/plan/PlanDraftWorkspace.tsx",
      "grid w-full min-w-0 flex-1 content-start gap-4 overflow-x-hidden px-4 py-6",
    ],
  ];

  for (const [path, obsoleteClass] of obsoleteRootClasses) {
    assert.ok(
      !read(path).includes(obsoleteClass),
      `${path} must expose page-level horizontal overflow`,
    );
  }
});
