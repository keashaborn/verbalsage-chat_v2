import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRequiredProductionAuthEnv,
  missingRequiredProductionAuthEnv,
} from "../scripts/verifyProductionEnvironment.mjs";

const completeEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "publishable-test-value",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-public-test-value",
  TURNSTILE_SECRET_KEY: "turnstile-secret-test-value",
};

test("reports every missing production authentication variable", () => {
  assert.deepEqual(missingRequiredProductionAuthEnv({}), [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
  ]);
});

test("treats whitespace-only values as missing", () => {
  assert.deepEqual(
    missingRequiredProductionAuthEnv({
      ...completeEnvironment,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "   ",
    }),
    ["NEXT_PUBLIC_TURNSTILE_SITE_KEY"],
  );
});

test("accepts a complete production authentication environment", () => {
  assert.deepEqual(missingRequiredProductionAuthEnv(completeEnvironment), []);
  assert.doesNotThrow(() =>
    assertRequiredProductionAuthEnv(completeEnvironment),
  );
});

test("fails closed with the missing variable names", () => {
  assert.throws(
    () =>
      assertRequiredProductionAuthEnv({
        ...completeEnvironment,
        TURNSTILE_SECRET_KEY: "",
      }),
    /TURNSTILE_SECRET_KEY/,
  );
});
