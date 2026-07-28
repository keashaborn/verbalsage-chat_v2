import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL("../lib/setupCodeFragment.ts", import.meta.url).href;
const { normalizeSetupCode, parseSetupCodeFragment } = await import(moduleUrl);

test("setup codes are accepted only from the dedicated URL fragment", () => {
  assert.deepEqual(parseSetupCodeFragment("#setup_code=123456"), {
    present: true,
    code: "123456",
  });
  assert.deepEqual(parseSetupCodeFragment("#setup_code=12345678"), {
    present: true,
    code: "12345678",
  });
  assert.deepEqual(
    parseSetupCodeFragment("#setup_code=12345678&ignored=value"),
    {
      present: true,
      code: "12345678",
    },
  );
});

test("invalid or unrelated fragments fail closed", () => {
  assert.deepEqual(parseSetupCodeFragment(""), {
    present: false,
    code: null,
  });
  assert.deepEqual(parseSetupCodeFragment("#access_token=secret"), {
    present: false,
    code: null,
  });
  assert.deepEqual(parseSetupCodeFragment("#setup_code=12345"), {
    present: true,
    code: null,
  });
  assert.deepEqual(parseSetupCodeFragment("#setup_code=1234%2056"), {
    present: true,
    code: null,
  });
});

test("manual code entry ignores email-client formatting characters", () => {
  assert.equal(normalizeSetupCode("12 34-56"), "123456");
  assert.equal(normalizeSetupCode("12\u200b34\u200b56"), "123456");
});
