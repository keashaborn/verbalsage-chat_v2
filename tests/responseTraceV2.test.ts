import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RESPONSE_TRACE_SAFE_COPY_VERSION,
  RESPONSE_TRACE_VERSION,
  responseInspectionFromValue,
  responseInspectionV1FromValue,
  responseTraceV2FromValue,
  safeResponseTraceForCopy,
  type ResponseInspectionV1,
  type ResponseInspectionV2,
  type ResponseInspectionV3,
  type ResponseInspectionV4,
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

const inspectionV2: ResponseInspectionV2 = {
  ...inspection,
  contract_version: "response_inspection_v2",
  before_openai: {
    ...inspection.before_openai,
    interaction_version: "response_interaction_v3",
    interaction: "CONVERSATIONAL",
    question_policy: "NOT_APPLICABLE",
    interaction_reason_codes: ["conversational_update_default"],
    personalization: {
      contract_version: "assistant_response_preference_inspection_v1",
      source: "postgres",
      status: "applied",
      assistant_name_included: true,
      presentation_fields_applied: 1,
      profile_fields_included: 2,
      custom_instructions_included: false,
      suppressed_field_count: 0,
      truncated_field_count: 0,
      high_stakes_override: false,
      estimated_tokens: 42,
    },
  },
};

const inspectionV3: ResponseInspectionV3 = {
  ...inspectionV2,
  contract_version: "response_inspection_v3",
  before_openai: {
    ...inspectionV2.before_openai,
    lifeswitch_status: "SELECTED",
    lifeswitch_intent: "plan_adherence_summary",
    lifeswitch_reason_codes: ["current_plan_requested"],
    lifeswitch_database_accessed: true,
    lifeswitch_timezone_source: "account_profile",
    lifeswitch_included: true,
    lifeswitch_record_count: 4,
    lifeswitch_estimated_tokens: 210,
    lifeswitch_projections: ["plan_summary", "nutrition_adherence"],
    lifeswitch_source_contract_version: "lifeswitch_domain_context_v1",
  },
  after_openai: {
    ...inspectionV2.after_openai,
    lifeswitch_binding: "bound",
    lifeswitch_binding_contract_version: "lifeswitch_answer_binding_v1",
  },
};

const inspectionV4: ResponseInspectionV4 = {
  ...inspectionV3,
  contract_version: "response_inspection_v4",
  before_openai: {
    ...inspectionV3.before_openai,
    prior_lifeswitch_provenance_status: "SELECTED",
    prior_lifeswitch_provenance_database_accessed: true,
    prior_lifeswitch_provenance_included: true,
    prior_lifeswitch_response_count: 1,
    prior_lifeswitch_source_ref_count: 2,
    prior_lifeswitch_estimated_tokens: 96,
  },
  after_openai: {
    ...inspectionV3.after_openai,
    lifeswitch_provenance_receipt: "bound",
    lifeswitch_provenance_receipt_contract_version:
      "lifeswitch_answer_provenance_receipt_v1",
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
  response_inspection: inspectionV2,
};

test("trace v2 preserves server authority and the current backend inspection", () => {
  assert.equal(responseTraceV2FromValue(trace), trace);
  assert.equal(responseInspectionFromValue(inspectionV2), inspectionV2);
  assert.equal(responseInspectionV1FromValue(inspection), inspection);
  assert.equal(responseInspectionV1FromValue(inspectionV2), null);
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
    "response_inspection_v2",
  );
  assert.equal(
    trace.response_inspection?.before_openai.interaction,
    "CONVERSATIONAL",
  );
  assert.equal(
    trace.response_inspection?.before_openai.personalization?.status,
    "applied",
  );
});

test("inspection v3 preserves bounded LifeSwitch selection and binding", () => {
  assert.equal(responseInspectionFromValue(inspectionV3), inspectionV3);
  assert.equal(responseTraceV2FromValue(inspectionV3), inspectionV3);
  assert.equal(inspectionV3.before_openai.lifeswitch_record_count, 4);
  assert.deepEqual(inspectionV3.before_openai.lifeswitch_projections, [
    "plan_summary",
    "nutrition_adherence",
  ]);
  assert.equal(inspectionV3.after_openai.lifeswitch_binding, "bound");

  const traceV3: ResponseTraceV2 = {
    ...trace,
    authorities: {
      ...trace.authorities,
      response_runtime: "resse_response_v0_3",
    },
    response_inspection: inspectionV3,
  };
  assert.equal(responseTraceV2FromValue(traceV3), traceV3);
  const safe = JSON.stringify(safeResponseTraceForCopy(traceV3));
  assert.match(safe, /plan_adherence_summary/);
  assert.match(safe, /lifeswitch_answer_binding_v1/);
  assert.doesNotMatch(safe, /answer-sensitive-id/);
});

test("inspection v4 preserves content-free prior-answer provenance", () => {
  assert.equal(responseInspectionFromValue(inspectionV4), inspectionV4);
  assert.equal(responseTraceV2FromValue(inspectionV4), inspectionV4);

  const traceV4: ResponseTraceV2 = {
    ...trace,
    response_inspection: inspectionV4,
  };
  assert.equal(responseTraceV2FromValue(traceV4), traceV4);
  const safe = JSON.stringify(safeResponseTraceForCopy(traceV4));
  assert.match(safe, /response_inspection_v4/);
  assert.match(safe, /prior_lifeswitch_provenance_status/);
  assert.match(safe, /lifeswitch_answer_provenance_receipt_v1/);
  assert.doesNotMatch(safe, /answer-sensitive-id/);
});

test("safe copy removes operational identifiers without losing decisions", () => {
  const safe = safeResponseTraceForCopy(trace);
  const serialized = JSON.stringify(safe);

  assert.equal(safe.copy_contract, RESPONSE_TRACE_SAFE_COPY_VERSION);
  assert.match(serialized, /search_prohibited_by_user/);
  assert.match(serialized, /CONVERSATIONAL/);
  assert.match(serialized, /conversational_update_default/);
  assert.match(serialized, /assistant_response_preference_inspection_v1/);
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
  const malformed = structuredClone(inspectionV2) as any;
  malformed.openai.total_tokens = -1;
  assert.equal(responseInspectionFromValue(malformed), null);
  assert.equal(
    responseTraceV2FromValue({ contract_version: "invented_trace" }),
    null,
  );
});

test("inspection v2 requires all content-free interaction fields", () => {
  for (const key of [
    "interaction_version",
    "interaction",
    "question_policy",
    "interaction_reason_codes",
  ]) {
    const malformed = structuredClone(inspectionV2) as any;
    delete malformed.before_openai[key];
    assert.equal(
      responseInspectionFromValue(malformed),
      null,
      `missing ${key}`,
    );
  }
});

test("inspection v3 requires content-free LifeSwitch fields", () => {
  for (const key of [
    "lifeswitch_status",
    "lifeswitch_intent",
    "lifeswitch_reason_codes",
    "lifeswitch_database_accessed",
    "lifeswitch_timezone_source",
    "lifeswitch_included",
    "lifeswitch_record_count",
    "lifeswitch_estimated_tokens",
    "lifeswitch_projections",
  ]) {
    const malformed = structuredClone(inspectionV3) as any;
    delete malformed.before_openai[key];
    assert.equal(
      responseInspectionFromValue(malformed),
      null,
      `missing ${key}`,
    );
  }
  const missingBinding = structuredClone(inspectionV3) as any;
  delete missingBinding.after_openai.lifeswitch_binding;
  assert.equal(responseInspectionFromValue(missingBinding), null);
});

test("inspection v4 requires content-free provenance fields", () => {
  for (const key of [
    "prior_lifeswitch_provenance_status",
    "prior_lifeswitch_provenance_database_accessed",
    "prior_lifeswitch_provenance_included",
    "prior_lifeswitch_response_count",
    "prior_lifeswitch_source_ref_count",
    "prior_lifeswitch_estimated_tokens",
  ]) {
    const malformed = structuredClone(inspectionV4) as any;
    delete malformed.before_openai[key];
    assert.equal(
      responseInspectionFromValue(malformed),
      null,
      `missing ${key}`,
    );
  }
  const missingReceipt = structuredClone(inspectionV4) as any;
  delete missingReceipt.after_openai.lifeswitch_provenance_receipt;
  assert.equal(responseInspectionFromValue(missingReceipt), null);
});

test("trace v2 rejects a malformed nested inspection", () => {
  const malformedTrace = structuredClone(trace) as any;
  delete malformedTrace.response_inspection.before_openai.question_policy;
  assert.equal(responseTraceV2FromValue(malformedTrace), null);
});

test("inspection v1 remains readable only for rollback compatibility", () => {
  assert.equal(responseInspectionFromValue(inspection), inspection);
  assert.equal(responseTraceV2FromValue(inspection), inspection);
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
  assert.match(chat, /responseInspectionFromValue/);
  assert.doesNotMatch(chat, /manualSearchResponseTraceV2/);
  assert.doesNotMatch(chat, /web_search\.override/);
  for (const route of [health, news]) {
    assert.match(route, /status: 410/);
    assert.doesNotMatch(route, /responseTraceHeadersV2/);
    assert.doesNotMatch(route, /manualSearchResponseTraceV2/);
    assert.doesNotMatch(route, /body\?\.response_trace|body\?\.inspection/);
  }
  assert.doesNotMatch(chat, /body\?\.response_trace|body\?\.inspection/);
});

test("read-only panel exposes decisions and copies only the safe trace", () => {
  const panel = source("components/threads/ResponseTrace.tsx");
  const pane = source("components/threads/BrainsChatPane.tsx");

  assert.match(panel, /Decision and execution/);
  assert.match(panel, /Authorization/);
  assert.match(panel, /Web access/);
  assert.match(panel, /Copy safe trace/);
  assert.match(panel, /responseInspectionFromTrace/);
  assert.match(panel, /Interaction/);
  assert.match(panel, /Question policy/);
  assert.match(panel, /interaction_reason_codes/);
  assert.match(panel, /Personalization/);
  assert.match(panel, /Prior answer evidence/);
  assert.match(panel, /Prior answer sources/);
  assert.match(panel, /Provenance receipt/);
  assert.match(panel, /estimated_tokens/);
  assert.match(pane, /safeResponseTraceForCopy\(inspect\)/);
  assert.doesNotMatch(pane, /JSON\.stringify\(inspect, null, 2\)/);
  assert.doesNotMatch(panel, /<select|<input|<textarea/);
});
