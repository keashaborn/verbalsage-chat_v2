import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/lifeswitch/training/session/page.tsx", "utf8");

test("past-workout detail has a semantic page and exercise hierarchy", () => {
  assert.match(source, /<h1[^>]*>\s*\{session\?\.name \|\| "Training Session"\}\s*<\/h1>/);
  assert.match(source, /<h2[^>]*>\s*\{block\.exerciseName\}\s*<\/h2>/);
  assert.match(source, /<time dateTime=\{session\.day\}>\s*\{formatSessionDay\(session\.day\)\}\s*<\/time>/);
});

test("summary remains flat and uses readable formatted metrics", () => {
  assert.match(source, /<dl className="mt-5 flex flex-wrap/);
  assert.match(source, />\s*Strength exercises\s*<\/dt>/);
  assert.match(source, />\s*Strength sets\s*<\/dt>/);
  assert.match(source, />\s*Strength volume\s*<\/dt>/);
  assert.match(source, /formatMetric\(summary\.strengthVolume\)/);
  assert.doesNotMatch(source, /rounded-xl border bg-muted\/20 p-3/);
});

test("quiet controls retain full touch targets and visible focus", () => {
  assert.match(source, /inline-flex min-h-11 items-center text-sm/);
  assert.match(source, /inline-flex min-h-11 shrink-0 items-center rounded-lg/);
  assert.match(source, /focus-visible:ring-2 focus-visible:ring-ring/);
});

test("set and drop-set metrics use phone-safe min-zero columns", () => {
  const responsiveRows = source.match(/grid-cols-\[3\.5rem_repeat\(3,minmax\(0,1fr\)\)\]/g) || [];
  assert.equal(responsiveRows.length, 2);
  assert.match(source, /grid-cols-\[4\.5rem_minmax\(0,1fr\)\]/);
  assert.match(source, /<dl className="grid min-w-0 grid-cols-3 gap-x-3">/);
  assert.match(source, /tabular-nums/);
});

test("loading and empty states are announced without boxed cards", () => {
  assert.match(source, /role="status"\s+aria-live="polite"\s+aria-atomic="true"\s*>\s*Loading session…\s*<\/div>/);
  assert.match(source, /border-y border-border\/60 py-4 text-sm text-muted-foreground/);
  assert.doesNotMatch(source, /rounded-xl border p-4 text-sm text-muted-foreground/);
});

test("existing read-only data contract and navigation remain in place", () => {
  assert.match(source, /authFetch\(url, \{ cache: "no-store"/);
  assert.match(source, /\/api\/lifeswitch\/training\/sessions\/\$\{encodeURIComponent\(sessionId\)\}/);
  assert.match(source, /\/sets\/\$\{encodeURIComponent\(row\.training_set_log_id\)\}\/segments/);
  assert.match(source, /href=\{`\/lifeswitch\/training\/calendar/);
  assert.match(source, /This delegated view is read-only\./);
  assert.doesNotMatch(source, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
});
