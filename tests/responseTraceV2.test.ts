import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RESPONSE_TRACE_SAFE_COPY_VERSION,
  RESPONSE_TRACE_VERSION,
  responseInspectionV1FromValue,
  responseTraceV2FromValue,
  safeResponseTraceForCopy,
  type ResponseInspectionV1,
  type ResponseTraceV2,
  // @ts-expect-error Node's strip-types runner requires the TypeScript extension.
} from "../lib/responseTraceV2.ts";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const inspection: ResponseInspectionV1 = {
  contract_version: "response_inspection_v1",
  delivery: {
    channel: "voice",
    voice_turn_id: "voice-turn-sensitive-id",
  },
  before_openai: {
    response_mode: "ORDINARY",
    closure: "complete",
    high_stakes_gate: "pass",
    safety_action_required: false,
    safety_reason_codes: [],
    mode_reason_codes: ["ordinary_default"],
    fm_level: "OFF",
    fm_status: "OFF",
    fm_record_count: 1,
    fm_selected_record_ids: ["fm-sensitive-record-id"],
    fm_estimated_tokens: 20,
    memory_included: false,
    memory_record_count: 0,
    memory_estimated_tokens: 0,
    context_block_count: 0,
    conversation_message_count: 3,
    total_message_count: 4,
    estimated_input_tokens: 540,
    ignored_legacy_request_fields: [],
  },
  openai: {
    response_id: "provider-sensitive-response-id",
    requested_model: "gpt-5.2",
    returned_model: "gpt-5.2-2025-12-11",
    finish_reason: "stop",
    input_tokens: 443,
    output_tokens: 81,
    total_tokens: 524,
  },
  after_openai: {
    answer_id: "answer-sensitive-id",
    output_kind: "content",
    validation: "passed",
    answer_binding: "bound",
    transcript_persistence: "persisted",
    memory_binding: "none",
  },
};

const trace: ResponseTraceV2 = {
  contract_version: RESPONSE_TRACE_VERSION,
  authorities: {
    identity: "supabase",
    routing: "verbalsage_server_v1",
    response_runtime: "resse_response_v0_2",
  },
  request: {
    request_id: "request-correlation-id",
    channel: "text",
    transcript_persistence: "persisted",
  },
  authorization: {
    actor_verification: "supabase_fresh_user_lookup",
    execution_authorization: "supabase_authenticated",
    inspection_capability: "inspector.view",
    inspection_verification: "supabase_fresh_user_lookup",
  },
  routing: {
    search_mode: "auto",
    policy_version: "search_decision_v1_3",
    decision: "no_search",
    reason_codes: ["search_prohibited_by_user"],
    policy_pack: "none",
    selected_route: "normal_chat",
    attempted_route: null,
    executed_external_web_access: false,
    fallback_to_chat: false,
    budget: { max_searches: 0, max_sources: 0 },
  },
  execution: {
    web_searched: false,
    source_count: 0,
    cited_source_count: 0,
    admitted_source_count: 0,
    provider_consulted_source_count: 0,
    consulted_source_count: 0,
    rejected_source_count: 0,
    validation: "passed",
  },
  timings: { backend_total_ms: 850, answer_generation_ms: 500 },
  response_inspection: inspection,
};

test("trace v2 preserves server authority and the strict backend inspection", () => {
  assert.equal(responseTraceV2FromValue(trace), trace);
  assert.equal(responseInspectionV1FromValue(inspection), inspection);
  assert.equal(trace.authorities.identity, "supabase");
  assert.equal(
    trace.authorization.inspection_verification,
    "supabase_fresh_user_lookup",
  );
  assert.equal(trace.routing.executed_external_web_access, false);
  assert.equal(trace.execution.cited_source_count, 0);
  assert.equal(trace.execution.admitted_source_count, 0);
  assert.equal(trace.execution.provider_consulted_source_count, 0);
  assert.equal(trace.execution.consulted_source_count, 0);
  assert.equal(trace.execution.rejected_source_count, 0);
  assert.equal(
    trace.response_inspection?.contract_version,
    "response_inspection_v1",
  );
});

test("safe copy removes operational identifiers without losing decisions", () => {
  const safe = safeResponseTraceForCopy(trace);
  const serialized = JSON.stringify(safe);

  assert.equal(safe.copy_contract, RESPONSE_TRACE_SAFE_COPY_VERSION);
  assert.match(serialized, /search_prohibited_by_user/);
  assert.match(serialized, /request-correlation-id/);
  for (const forbidden of [
    "provider-sensitive-response-id",
    "answer-sensitive-id",
    "voice-turn-sensitive-id",
    "fm-sensitive-record-id",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden));
  }
});

test("malformed backend inspection is rejected before trace composition", () => {
  const malformed = structuredClone(inspection) as any;
  malformed.openai.total_tokens = -1;
  assert.equal(responseInspectionV1FromValue(malformed), null);
  assert.equal(
    responseTraceV2FromValue({ contract_version: "invented_trace" }),
    null,
  );
});

test("Inspector uses cookie-gated fresh Supabase verification", () => {
  const access = source("app/api/_inspection/responseTraceV2.ts");
  const chat = source("app/api/chat/route.ts");

  const cookieIndex = access.indexOf("responseTraceSessionEnabled()");
  const freshIndex = access.indexOf(
    'requireFreshCapability(req, "inspector.view")',
  );
  assert.ok(cookieIndex >= 0 && cookieIndex < freshIndex);
  assert.match(chat, /responseTraceAccessAllowedV2\(req\)/);
  assert.match(chat, /getFreshSupabaseAuthContextFromRequest\(req\)/);
  assert.doesNotMatch(chat, /requireCapability\(req, "inspector\.view"\)/);
  assert.match(access, /MAX_RESPONSE_TRACE_HEADER_BYTES = 6_000/);
  assert.match(access, /private, no-store/);
  assert.match(access, /Vary: "Authorization, Cookie"/);
});

test("server composes trace v2 for ordinary and automatic web paths", () => {
  const chat = source("app/api/chat/route.ts");
  const health = source("app/api/trusted-web/route.ts");
  const news = source("app/api/current-news/route.ts");

  assert.match(chat, /ordinaryResponseTraceV2/);
  assert.match(chat, /automaticSearchTraceV2/);
  assert.match(chat, /responseTraceHeadersV2/);
  assert.match(chat, /fallbackToChat: automaticFallbackToChat/);
  assert.match(chat, /responseInspectionV1FromValue/);
  assert.match(health, /X-VS-Web-Source-Count/);
  assert.match(news, /X-VS-Web-Source-Count/);
  assert.match(health, /manualSearchResponseTraceV2/);
  assert.match(news, /manualSearchResponseTraceV2/);
  for (const route of [chat, health, news]) {
    assert.doesNotMatch(route, /body\?\.response_trace|body\?\.inspection/);
  }
});

test("read-only panel exposes decisions and copies only the safe trace", () => {
  const panel = source("components/threads/ResponseTrace.tsx");
  const pane = source("components/threads/BrainsChatPane.tsx");

  assert.match(panel, /Decision and execution/);
  assert.match(panel, /Authorization/);
  assert.match(panel, /Web access/);
  assert.match(panel, /Copy safe trace/);
  assert.match(panel, /responseInspectionFromTrace/);
  assert.match(pane, /safeResponseTraceForCopy\(inspect\)/);
  assert.doesNotMatch(pane, /JSON\.stringify\(inspect, null, 2\)/);
  assert.doesNotMatch(panel, /<select|<input|<textarea/);
});
