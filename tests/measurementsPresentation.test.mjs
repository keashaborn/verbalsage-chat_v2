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
const sharedSegments = readFileSync(
  "components/lifeswitch/SegmentTabs.tsx",
  "utf8",
);

test("measurements overview stays flat and preserves its useful summary", () => {
  assert.match(workspace, />Measurements</);
  assert.match(workspace, />\s*\+\s*Record\s*</);
  assert.doesNotMatch(
    workspace,
    /Record body-state observations and compare like with like over time/,
  );
  assert.match(workspace, /label="Weight"/);
  assert.match(workspace, /label="Waist"/);
  assert.match(workspace, /label="Body fat"/);
  assert.match(workspace, />\s*History\s*</);
  assert.match(workspace, />\s*Progress\s*</);
  assert.match(workspace, /aria-label="Measurement views"/);
  assert.doesNotMatch(
    workspace,
    /Each chart uses one consistent source and method/,
  );
});

test("overview actions and disclosures are touch-safe above the mobile dock", () => {
  assert.match(
    workspace,
    /pb-\[calc\(7rem\+env\(safe-area-inset-bottom\)\)\] md:pb-8/,
  );
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

test("capture leads with context and reuses the shared segmented treatment", () => {
  assert.match(capture, />\s*Measurements · Capture\s*</);
  assert.match(capture, /aria-label="Measurement date"/);
  assert.doesNotMatch(capture, /← Measurements/);
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
  assert.match(
    capture,
    /pb-\[calc\(7rem\+env\(safe-area-inset-bottom\)\)\] md:pb-8/,
  );
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
