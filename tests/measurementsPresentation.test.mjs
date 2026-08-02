import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  "components/lifeswitch/measurements/MeasurementWorkspace.tsx",
  "utf8",
);
const capture = readFileSync(
  "app/lifeswitch/measurements/capture/page.tsx",
  "utf8",
);
const measurementsPage = readFileSync(
  "app/lifeswitch/measurements/page.tsx",
  "utf8",
);
const routeChrome = readFileSync(
  "components/lifeswitch/LifeSwitchRouteChrome.tsx",
  "utf8",
);
const sharedSegments = readFileSync(
  "components/lifeswitch/SegmentTabs.tsx",
  "utf8",
);

test("measurements overview combines selectable progress with history", () => {
  assert.match(workspace, />Measurements</);
  assert.match(workspace, />\s*\+\s*Record\s*</);
  assert.doesNotMatch(
    workspace,
    /Record body-state observations and compare like with like over time/,
  );
  assert.match(workspace, /label="Weight"/);
  assert.match(workspace, /label="Waist"/);
  assert.match(workspace, /label="Body fat"/);
  assert.match(workspace, /aria-label="Progress metric"/);
  assert.match(workspace, /role="group"/);
  assert.match(workspace, /aria-pressed=\{active\}/);
  assert.match(workspace, /aria-controls="measurement-progress"/);
  assert.match(workspace, /role="region"/);
  assert.match(
    workspace,
    /<TrendCard title=\{selectedTitle\} series=\{selectedSeries\} \/>/,
  );
  assert.match(workspace, />\s*History\s*</);
  assert.doesNotMatch(workspace, /aria-label="Measurement views"/);
  assert.doesNotMatch(workspace, /type WorkspaceView/);
  assert.doesNotMatch(workspace, /chooseView/);
  assert.doesNotMatch(workspace, /initialView/);
  assert.doesNotMatch(
    workspace,
    /Each chart uses one consistent source and method/,
  );
  assert.doesNotMatch(measurementsPage, /initialView=/);
});

test("measurements routes omit the workflow dock and retain touch-safe controls", () => {
  assert.match(workspace, /mx-auto max-w-5xl pb-8/);
  assert.match(
    routeChrome,
    /measurementsStandalone \? null : <LifeSwitchModeNav \/>/,
  );
  assert.match(routeChrome, /measurementsStandalone[\s\S]*?"pb-10"/);
  assert.match(
    workspace,
    /inline-flex min-h-11 items-center rounded-lg border border-border\/60/,
  );
  assert.match(
    workspace,
    /summary className="inline-flex min-h-11 cursor-pointer items-center text-sm/,
  );
  assert.match(workspace, /role="alert"/);
  assert.match(workspace, /Try again/);
});

test("capture has a quiet return path and reuses the shared segmented treatment", () => {
  assert.match(capture, /href="\/lifeswitch\/measurements"/);
  assert.match(capture, />\s*← Measurements\s*</);
  assert.match(capture, />\s*Record measurements\s*</);
  assert.match(capture, /aria-label="Measurement date"/);
  assert.doesNotMatch(capture, /Choose what you measured/);
  assert.doesNotMatch(capture, /What are you recording/);
  assert.match(capture, /aria-label="Measurement type"/);
  assert.match(capture, /segmentTabListClassName/);
  assert.match(capture, /segmentTabClassName\(entryKind === kind\)/);
  assert.match(sharedSegments, /min-h-11/);
  for (const label of ["Weight", "Tape", "Skinfolds", "Body scan"]) {
    assert.match(capture, new RegExp(`\\["[^"]+", "${label}"\\]`));
  }
});

test("routine directions are removed and detailed technique stays optional", () => {
  assert.doesNotMatch(capture, /Best practice: weigh at a consistent time/);
  assert.doesNotMatch(capture, /Enter the main values reported by a DEXA/);
  assert.match(capture, />\s*Measurement guidance\s*</);
  assert.match(capture, /entryKind === "tape" \|\| entryKind === "skinfolds"/);
  assert.match(capture, /Jackson–Pollock 7-site method/);
  assert.match(
    capture,
    /Diagonal fold halfway between the front armpit line and\s+nipple/,
  );
  assert.match(capture, />\s*Optional context\s*</);
});

test("capture controls and feedback retain a quiet touch-safe contract", () => {
  assert.match(capture, /mx-auto max-w-3xl pb-8/);
  assert.match(capture, /min-h-11 w-full rounded-lg border border-border\/60/);
  assert.match(capture, /aria-live="polite"/);
  assert.match(capture, /Measurement saved\./);
  assert.match(capture, /min-h-11 rounded-lg bg-primary px-4/);
  assert.match(
    capture,
    /min-h-11 rounded-lg px-3 text-sm text-muted-foreground/,
  );
  assert.match(
    capture,
    /<section className="mt-6" aria-label="Measurement entry">/,
  );
  assert.doesNotMatch(capture, /<main className="mt-6/);
});

test("measurement calculations, payloads, duplicate protection, and save wiring remain", () => {
  assert.match(capture, /jacksonPollock7Percent/);
  assert.match(
    capture,
    /body_fat_method: `jackson_pollock_7_site_\$\{skinfoldSex\}`/,
  );
  assert.match(capture, /skinfolds_json:/);
  assert.match(capture, /scan_json:/);
  assert.match(capture, /hasUsefulData\(payload\)/);
  assert.match(capture, /entries\?limit=250/);
  assert.match(capture, /It was not overwritten/);
  assert.match(capture, /measurements\/entries\/create/);
  assert.match(capture, /method: "POST"/);
  assert.match(capture, /body: JSON\.stringify\(payload\)/);
  assert.match(capture, /onClick=\{\(\) => void saveEntry\(\)\}/);
  assert.match(capture, /onClick=\{clearForm\}/);
});
