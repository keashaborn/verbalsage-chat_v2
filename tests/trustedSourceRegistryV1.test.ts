import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types test runner loads the TypeScript file directly.
import {
  CURRENT_NEWS_ALLOWED_SOURCE_DOMAINS,
  MEDICAL_HEALTH_SOURCE_DOMAINS,
  NUTRITION_FOOD_SOURCE_DOMAINS,
  EXERCISE_TRAINING_SOURCE_DOMAINS,
  SOFTWARE_SECURITY_REFERENCE_SOURCE_DOMAINS,
  TRUSTED_EVIDENCE_ALLOWED_SOURCE_DOMAINS,
  TRUSTED_SOURCE_REGISTRY_VERSION,
} from "../lib/trustedSourceRegistryV1.ts";

test("BFF registry mirrors bounded backend source packs", () => {
  assert.equal(
    TRUSTED_SOURCE_REGISTRY_VERSION,
    "trusted_source_registry_v1",
  );
  assert.ok(CURRENT_NEWS_ALLOWED_SOURCE_DOMAINS.includes("nhk.or.jp"));
  assert.ok(MEDICAL_HEALTH_SOURCE_DOMAINS.includes("clinicaltrials.gov"));
  assert.ok(MEDICAL_HEALTH_SOURCE_DOMAINS.includes("cochranelibrary.com"));
  assert.ok(NUTRITION_FOOD_SOURCE_DOMAINS.includes("fdc.nal.usda.gov"));
  assert.ok(EXERCISE_TRAINING_SOURCE_DOMAINS.includes("acsm.org"));
  assert.ok(EXERCISE_TRAINING_SOURCE_DOMAINS.includes("nsca.com"));
  assert.ok(
    SOFTWARE_SECURITY_REFERENCE_SOURCE_DOMAINS.includes(
      "developers.openai.com",
    ),
  );
  assert.ok(
    TRUSTED_EVIDENCE_ALLOWED_SOURCE_DOMAINS.includes("developer.mozilla.org"),
  );
});

test("BFF validation unions are deduplicated and remain bounded", () => {
  assert.equal(
    CURRENT_NEWS_ALLOWED_SOURCE_DOMAINS.length,
    new Set(CURRENT_NEWS_ALLOWED_SOURCE_DOMAINS).size,
  );
  assert.equal(
    TRUSTED_EVIDENCE_ALLOWED_SOURCE_DOMAINS.length,
    new Set(TRUSTED_EVIDENCE_ALLOWED_SOURCE_DOMAINS).size,
  );
  assert.ok(CURRENT_NEWS_ALLOWED_SOURCE_DOMAINS.length <= 100);
  assert.ok(TRUSTED_EVIDENCE_ALLOWED_SOURCE_DOMAINS.length <= 100);
});
