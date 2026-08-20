import assert from "node:assert/strict";
import test from "node:test";

import {
  BACKEND_CONVERSATION_RUNTIMES,
  CONVERSATION_RESPONSE_RUNTIME_V1,
  LEGACY_CONVERSATION_RESPONSE_RUNTIME_V0_2,
  LEGACY_LIFESWITCH_RESPONSE_RUNTIME_V0_3,
  LEGACY_LIFESWITCH_RESPONSE_RUNTIME_V0_4,
  LIFESWITCH_RESPONSE_RUNTIME_V1,
  backendConversationRuntimeFromValue,
  // @ts-expect-error Node's strip-types runner requires the TypeScript extension.
} from "../lib/conversationRuntimeV1.ts";
import {
  RESPONSE_TRACE_VERSION,
  responseTraceV2FromValue,
  // @ts-expect-error Node's strip-types runner requires the TypeScript extension.
} from "../lib/responseTraceV2.ts";

const minimalTrace = (runtime: string) => ({
  contract_version: RESPONSE_TRACE_VERSION,
  authorities: {
    identity: "supabase",
    routing: "verbalsage_server_authority_v1",
    response_runtime: runtime,
  },
  request: {},
  authorization: {},
  routing: { reason_codes: [] },
  execution: {},
  response_inspection: null,
});

test("backend runtime registry has exact canonical and historical values", () => {
  assert.deepEqual(BACKEND_CONVERSATION_RUNTIMES, [
    CONVERSATION_RESPONSE_RUNTIME_V1,
    LIFESWITCH_RESPONSE_RUNTIME_V1,
    LEGACY_CONVERSATION_RESPONSE_RUNTIME_V0_2,
    LEGACY_LIFESWITCH_RESPONSE_RUNTIME_V0_3,
    LEGACY_LIFESWITCH_RESPONSE_RUNTIME_V0_4,
  ]);
  for (const runtime of BACKEND_CONVERSATION_RUNTIMES) {
    assert.equal(backendConversationRuntimeFromValue(runtime), runtime);
  }
});

test("runtime registry rejects arbitrary values", () => {
  for (const value of [
    "",
    "invented_runtime",
    "RESSE",
    1,
    null,
    undefined,
    {},
  ]) {
    assert.equal(backendConversationRuntimeFromValue(value), null);
  }
});

test("trace reader admits canonical and historical runtimes only", () => {
  for (const runtime of BACKEND_CONVERSATION_RUNTIMES) {
    const trace = minimalTrace(runtime);
    assert.equal(responseTraceV2FromValue(trace), trace);
  }
  assert.equal(responseTraceV2FromValue(minimalTrace("invented_runtime")), null);
});
