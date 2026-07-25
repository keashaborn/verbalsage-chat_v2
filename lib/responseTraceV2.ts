import type {
  AutomaticSearchRouteV1,
  SearchDecisionClassV1,
  SearchPolicyPackV1,
} from "@/lib/searchDecisionV1";

export const RESPONSE_TRACE_VERSION = "response_trace_v2";
export const RESPONSE_TRACE_SAFE_COPY_VERSION = "response_trace_safe_copy_v1";

export type ResponseInspectionV1 = {
  contract_version: "response_inspection_v1";
  delivery?: {
    channel: "voice";
    voice_turn_id: string;
  } | null;
  before_openai: {
    response_mode: string;
    closure: string;
    high_stakes_gate: string;
    safety_action_required: boolean;
    safety_reason_codes: string[];
    mode_reason_codes: string[];
    fm_level: string;
    fm_status: string;
    fm_record_count: number;
    fm_selected_record_ids: string[];
    fm_estimated_tokens: number;
    memory_included: boolean;
    memory_record_count: number;
    memory_estimated_tokens: number;
    context_block_count: number;
    conversation_message_count: number;
    total_message_count: number;
    estimated_input_tokens: number;
    ignored_legacy_request_fields: string[];
  };
  openai: {
    response_id: string;
    requested_model: string;
    returned_model: string;
    finish_reason: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  after_openai: {
    answer_id: string;
    output_kind: string;
    validation: "passed";
    answer_binding: "bound";
    transcript_persistence: "persisted" | "skipped";
    memory_binding: "bound" | "none";
  };
};

export type ResponseTraceTimingV2 = {
  command_validation_ms?: number;
  conversation_snapshot_ms?: number;
  policy_input_ms?: number;
  signal_classification_ms?: number;
  signal_binding_ms?: number;
  memory_selection_ms?: number;
  trusted_request_ms?: number;
  orchestration_ms?: number;
  answer_generation_ms?: number;
  finalization_ms?: number;
  pipeline_total_ms?: number;
  persistence_ms?: number;
  backend_total_ms?: number;
};

export type ResponseTraceSearchDecisionV2 =
  | SearchDecisionClassV1
  | "manual_override"
  | "not_evaluated";

export type ResponseTraceV2 = {
  contract_version: typeof RESPONSE_TRACE_VERSION;
  authorities: {
    identity: "supabase";
    routing:
      | "verbalsage_server_v1"
      | "verbalsage_server_authority_v1"
      | "seebx_search_plan_v1";
    response_runtime:
      | "resse_response_v0_2"
      | "trusted_web_v1"
      | "current_news_v1";
  };
  request: {
    request_id: string;
    channel: "text" | "voice";
    transcript_persistence: "persisted" | "skipped";
  };
  authorization: {
    actor_verification: "supabase_jwks_jwt" | "supabase_fresh_user_lookup";
    execution_authorization:
      | "supabase_authenticated"
      | "web_search.use"
      | "web_search.override";
    inspection_capability: "inspector.view";
    inspection_verification: "supabase_fresh_user_lookup";
  };
  routing: {
    search_mode: "off" | "auto" | "manual_override";
    policy_version: string;
    decision: ResponseTraceSearchDecisionV2;
    reason_codes: string[];
    policy_pack: SearchPolicyPackV1;
    selected_route: AutomaticSearchRouteV1;
    attempted_route: AutomaticSearchRouteV1 | null;
    executed_external_web_access: boolean;
    fallback_to_chat: boolean;
    budget: {
      max_searches: number;
      max_sources: number;
    } | null;
  };
  execution: {
    web_searched: boolean;
    source_count: number;
    cited_source_count?: number;
    admitted_source_count?: number;
    provider_consulted_source_count?: number;
    consulted_source_count?: number;
    rejected_source_count?: number;
    validation: "passed" | "failed";
  };
  timings: ResponseTraceTimingV2 | null;
  response_inspection: ResponseInspectionV1 | null;
};

export type ResponseTrace = ResponseTraceV2 | ResponseInspectionV1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function responseInspectionV1FromValue(
  value: unknown,
): ResponseInspectionV1 | null {
  if (!isRecord(value) || value.contract_version !== "response_inspection_v1") {
    return null;
  }
  const before = value.before_openai;
  const openai = value.openai;
  const after = value.after_openai;
  if (!isRecord(before) || !isRecord(openai) || !isRecord(after)) return null;
  const beforeStrings = [
    "response_mode",
    "closure",
    "high_stakes_gate",
    "fm_level",
    "fm_status",
  ];
  const beforeNumbers = [
    "fm_record_count",
    "fm_estimated_tokens",
    "memory_record_count",
    "memory_estimated_tokens",
    "context_block_count",
    "conversation_message_count",
    "total_message_count",
    "estimated_input_tokens",
  ];
  if (
    beforeStrings.some((key) => typeof before[key] !== "string") ||
    beforeNumbers.some((key) => !isNonnegativeNumber(before[key])) ||
    typeof before.safety_action_required !== "boolean" ||
    typeof before.memory_included !== "boolean" ||
    !isStringArray(before.safety_reason_codes) ||
    !isStringArray(before.mode_reason_codes) ||
    !isStringArray(before.fm_selected_record_ids) ||
    !isStringArray(before.ignored_legacy_request_fields)
  ) {
    return null;
  }
  if (
    typeof openai.response_id !== "string" ||
    typeof openai.requested_model !== "string" ||
    typeof openai.returned_model !== "string" ||
    typeof openai.finish_reason !== "string" ||
    !isNonnegativeNumber(openai.input_tokens) ||
    !isNonnegativeNumber(openai.output_tokens) ||
    !isNonnegativeNumber(openai.total_tokens)
  ) {
    return null;
  }
  if (
    typeof after.answer_id !== "string" ||
    typeof after.output_kind !== "string" ||
    after.validation !== "passed" ||
    after.answer_binding !== "bound" ||
    !["persisted", "skipped"].includes(String(after.transcript_persistence)) ||
    !["bound", "none"].includes(String(after.memory_binding))
  ) {
    return null;
  }
  const delivery = value.delivery;
  if (
    delivery !== undefined &&
    delivery !== null &&
    (!isRecord(delivery) ||
      delivery.channel !== "voice" ||
      typeof delivery.voice_turn_id !== "string")
  ) {
    return null;
  }
  return value as ResponseInspectionV1;
}

export function responseInspectionFromTrace(
  trace: ResponseTrace | null,
): ResponseInspectionV1 | null {
  if (!trace) return null;
  return trace.contract_version === RESPONSE_TRACE_VERSION
    ? trace.response_inspection
    : trace;
}

export function responseTraceV2FromValue(value: unknown): ResponseTrace | null {
  if (!isRecord(value)) return null;
  if (value.contract_version === "response_inspection_v1") {
    return responseInspectionV1FromValue(value);
  }
  if (
    value.contract_version !== RESPONSE_TRACE_VERSION ||
    !isRecord(value.authorities) ||
    !isRecord(value.request) ||
    !isRecord(value.authorization) ||
    !isRecord(value.routing) ||
    !isRecord(value.execution) ||
    !Array.isArray(value.routing.reason_codes)
  ) {
    return null;
  }
  return value as ResponseTraceV2;
}

function safeInspectionCopy(
  inspection: ResponseInspectionV1,
): Record<string, unknown> {
  return {
    contract_version: inspection.contract_version,
    delivery: inspection.delivery
      ? { channel: inspection.delivery.channel }
      : null,
    before_openai: {
      ...inspection.before_openai,
      fm_selected_record_ids: [],
    },
    openai: {
      requested_model: inspection.openai.requested_model,
      returned_model: inspection.openai.returned_model,
      finish_reason: inspection.openai.finish_reason,
      input_tokens: inspection.openai.input_tokens,
      output_tokens: inspection.openai.output_tokens,
      total_tokens: inspection.openai.total_tokens,
    },
    after_openai: {
      output_kind: inspection.after_openai.output_kind,
      validation: inspection.after_openai.validation,
      answer_binding: inspection.after_openai.answer_binding,
      transcript_persistence: inspection.after_openai.transcript_persistence,
      memory_binding: inspection.after_openai.memory_binding,
    },
  };
}

export function safeResponseTraceForCopy(
  trace: ResponseTrace,
): Record<string, unknown> {
  if (trace.contract_version === "response_inspection_v1") {
    return {
      copy_contract: RESPONSE_TRACE_SAFE_COPY_VERSION,
      source_contract: trace.contract_version,
      trace: safeInspectionCopy(trace),
    };
  }
  return {
    copy_contract: RESPONSE_TRACE_SAFE_COPY_VERSION,
    source_contract: trace.contract_version,
    trace: {
      ...trace,
      response_inspection: trace.response_inspection
        ? safeInspectionCopy(trace.response_inspection)
        : null,
    },
  };
}
