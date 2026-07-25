import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluateSearchRoutingV1,
  parseSearchRoutingEvalCorpusV1,
  // @ts-expect-error Node's strip-types runner requires the TypeScript extension.
} from "../lib/searchRoutingEvalV1.ts";

async function rawCorpus(): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(
      new URL("../evals/search-routing-v1.json", import.meta.url),
      "utf8",
    ),
  ) as Record<string, unknown>;
}

test("versioned synthetic routing corpus passes every promotion gate", async () => {
  const corpus = parseSearchRoutingEvalCorpusV1(await rawCorpus());
  const report = evaluateSearchRoutingV1(corpus);

  assert.equal(corpus.data_classification, "synthetic_no_user_data");
  assert.equal(corpus.cases.length, 76);
  assert.equal(report.passed, true);
  assert.equal(report.overall_accuracy, 1);
  assert.equal(report.hard_requirement_accuracy, 1);
  assert.deepEqual(report.structural_violation_ids, []);
  assert.deepEqual(report.failures, []);
  assert.ok(Object.values(report.gates).every(Boolean));
  assert.ok(
    Object.values(report.categories).every((category) => category.gate_passed),
  );
});

test("promotion report contains failure IDs but never prompt text", async () => {
  const raw = await rawCorpus();
  const cases = raw.cases as Array<Record<string, unknown>>;
  const first = cases[0];
  const expected = first.expected as Record<string, unknown>;
  expected.decision = "live";

  const corpus = parseSearchRoutingEvalCorpusV1(raw);
  const report = evaluateSearchRoutingV1(corpus);
  const serialized = JSON.stringify(report);

  assert.equal(report.passed, false);
  assert.equal(report.gates.hard_requirements, false);
  assert.equal(report.failures[0]?.id, "no-search-001");
  assert.match(serialized, /no-search-001/);
  assert.doesNotMatch(serialized, /latest OpenAI news/);
  assert.doesNotMatch(serialized, /"prompt"/);
});

test("corpus parser rejects undersized required categories", async () => {
  const raw = await rawCorpus();
  const cases = raw.cases as Array<Record<string, unknown>>;
  raw.cases = cases.filter(
    (item) => item.category !== "specific_source_fail_closed",
  );

  assert.throws(
    () => parseSearchRoutingEvalCorpusV1(raw),
    /specific_source_fail_closed\.minimum_cases/,
  );
});
