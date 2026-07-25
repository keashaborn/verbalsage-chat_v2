import { readFile } from "node:fs/promises";

import {
  evaluateSearchRoutingV1,
  parseSearchRoutingEvalCorpusV1,
  // @ts-expect-error Node's strip-types runner requires the TypeScript extension.
} from "../lib/searchRoutingEvalV1.ts";

const corpusUrl = new URL("../evals/search-routing-v1.json", import.meta.url);

try {
  const raw = JSON.parse(await readFile(corpusUrl, "utf8")) as unknown;
  const corpus = parseSearchRoutingEvalCorpusV1(raw);
  const report = evaluateSearchRoutingV1(corpus);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error";
  process.stderr.write(
    `${JSON.stringify({
      schema_version: "search_routing_eval_v1",
      passed: false,
      error: message,
    })}\n`,
  );
  process.exitCode = 1;
}
