import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// @ts-expect-error Node's strip-types runner requires explicit extensions.
import { validateSagePageContract } from "../../lib/lifeswitch/sage/pageContract.ts";
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import { trainingCalendarContract } from "../../lib/lifeswitch/sage/pageContracts/trainingCalendar.ts";
const root = join(import.meta.dirname, "..", "..");
const calendarSource = readFileSync(
  join(root, "app/lifeswitch/training/calendar/page.tsx"),
  "utf8",
);
const modeNavSource = readFileSync(
  join(root, "components/lifeswitch/LifeSwitchModeNav.tsx"),
  "utf8",
);
const helperContextSource = readFileSync(
  join(root, "lib/lifeswitch/sage/trainingCalendarContext.ts"),
  "utf8",
);
const helperPromptSource = readFileSync(
  join(root, "lib/lifeswitch/sage/helperPrompt.ts"),
  "utf8",
);
const helperResponseSource = readFileSync(
  join(root, "app/api/lifeswitch/helper/respond/route.ts"),
  "utf8",
);
const pageRegistrySource = readFileSync(
  join(root, "lib/lifeswitch/sage/pageRegistry.ts"),
  "utf8",
);
const helperSource = readFileSync(
  join(root, "components/lifeswitch/helper/LifeSwitchHelper.tsx"),
  "utf8",
);

function control(id: string) {
  const found = trainingCalendarContract.controls.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(found, `missing control ${id}`);
  return found;
}

function state(id: string) {
  const found = trainingCalendarContract.states.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(found, `missing state ${id}`);
  return found;
}

test("Training Calendar contract passes enterprise invariants", () => {
  assert.deepEqual(validateSagePageContract(trainingCalendarContract), []);
});

test("registry is contract-derived and fails closed when no route matches", () => {
  assert.match(
    pageRegistrySource,
    /contract\.route\.canonicalPath === pathname/,
  );
  assert.match(
    pageRegistrySource,
    /contract\.route\.aliases\.includes\(pathname\)/,
  );
  assert.match(pageRegistrySource, /return null/);
  assert.doesNotMatch(pageRegistrySource, /behavior/);
});

test("Calendar dates are documented as display-only and Capture owns logging", () => {
  assert.equal(control("calendar.day_marker").kind, "display");
  assert.equal(control("calendar.day_marker").usableForTargetBy, "nobody");
  assert.equal(
    control("training.capture").destination,
    "/lifeswitch/training/capture",
  );
  assert.ok(
    trainingCalendarContract.responsePolicy.mustNot.some((rule) =>
      rule.includes("select a calendar date"),
    ),
  );
});

test("delegated access is read-only and mutations preserve audit history", () => {
  assert.equal(
    trainingCalendarContract.access.delegatedView.permission,
    "training:view",
  );
  assert.equal(trainingCalendarContract.access.delegatedView.mode, "read_only");

  for (const id of [
    "calendar.remove_strength_session",
    "calendar.remove_conditioning_session",
  ]) {
    const mutation = control(id);
    assert.equal(mutation.kind, "mutate");
    assert.equal(mutation.visibleTo, "owner_only");
    assert.equal(mutation.usableForTargetBy, "owner_only");
    assert.equal(mutation.confirmation, "browser_confirm");
    assert.equal(mutation.auditResult, "preserved");
  }
});

test("load failure cannot be answered as an empty history", () => {
  assert.ok(
    state("load_error").prohibitedClaims.includes(
      "No training sessions exist.",
    ),
  );
  assert.ok(
    trainingCalendarContract.responsePolicy.mustNot.some((rule) =>
      rule.includes("request failure"),
    ),
  );
});

test("Training interpretation requires the relevant Plan sections", () => {
  assert.deepEqual(trainingCalendarContract.planContext.sections, [
    "primary_goal",
    "phase",
    "training_targets",
    "conditioning_targets",
    "recovery_targets",
    "monitoring_rules",
  ]);
  assert.equal(
    trainingCalendarContract.planContext.mutationPolicy,
    "read_only_context",
  );
  assert.equal(
    trainingCalendarContract.dataSources.find(
      (source) => source.id === "plan.profile.current",
    )?.authorization,
    "authenticated_owner_or_plan_view",
  );
  assert.equal(
    trainingCalendarContract.dataSources.find(
      (source) => source.id === "training.recovery_adjustments.current",
    )?.authorization,
    "authenticated_owner_or_plan_view",
  );
});

test("contract evidence remains aligned with current frontend implementation", () => {
  assert.match(
    calendarSource,
    /\/api\/lifeswitch\/training\/sessions\?limit=250/,
  );
  assert.match(
    calendarSource,
    /\/api\/lifeswitch\/training\/conditioning_sessions\?limit=250/,
  );
  assert.match(calendarSource, /window\.confirm/);
  assert.match(calendarSource, /audit history will be preserved/);
  assert.match(
    calendarSource,
    /No training sessions yet\. Finish a workout from Capture/,
  );
  assert.match(calendarSource, /aria-label=\{`\$\{date\}: \$\{stateLabel\}`\}/);
  assert.doesNotMatch(calendarSource, /<button[^>]+key=\{date\}/);

  assert.match(modeNavSource, /\/lifeswitch\/training\/design\/workouts/);
  assert.match(modeNavSource, /\/lifeswitch\/training\/calendar/);
  assert.match(
    modeNavSource,
    /const captureHref = `\/lifeswitch\/\$\{domain\}\/capture`/,
  );
  assert.match(modeNavSource, /\/lifeswitch\/\$\{domain\}\/analyze/);

  assert.match(helperContextSource, /"\/lifeswitch\/plan\/profile"/);
  assert.match(helperContextSource, /create_if_missing: "0"/);
  assert.match(helperContextSource, /"\/lifeswitch\/training\/sessions"/);
  assert.doesNotMatch(helperContextSource, /\/lifeswitch\/nutrition/);
  assert.doesNotMatch(helperContextSource, /\/lifeswitch\/measurements/);
  assert.match(helperPromptSource, /Behavior treatment/);
  assert.match(helperPromptSource, /General Verbal Sage chat history/);
  assert.match(helperResponseSource, /getFreshSupabaseAuthContextFromRequest/);
  assert.match(helperResponseSource, /\/lifeswitch\/sage\/query/);
  assert.doesNotMatch(helperResponseSource, /\/api\/chat/);
  assert.match(helperSource, /isServerOwnedSageHelperRoute/);
  assert.match(helperSource, /\/api\/lifeswitch\/helper\/respond/);
});
