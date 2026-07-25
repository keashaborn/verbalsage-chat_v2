import { cookies } from "next/headers";

import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import {
  capabilityAllowsRole,
  normalizePermissionRole,
} from "@/app/api/_auth/requireCapability";
import {
  inspectorSessionCookieName,
  inspectorSessionEnabled,
} from "@/lib/inspectorSession";
import { SEARCH_DECISION_POLICY_VERSION } from "@/lib/searchDecisionV1";
import type { ResponseTraceV2 } from "@/lib/responseTraceV2";

const MAX_RESPONSE_TRACE_HEADER_BYTES = 6_000;

async function responseTraceSessionEnabled(): Promise<boolean> {
  const jar = await cookies();
  return inspectorSessionEnabled(jar.get(inspectorSessionCookieName())?.value);
}

export async function responseTraceAccessAllowedV2(
  req: Request,
): Promise<boolean> {
  if (!(await responseTraceSessionEnabled())) return false;
  const capability = await requireFreshCapability(req, "inspector.view");
  return capability.ok;
}

export async function responseTraceAccessAllowedForFreshRoleV2(
  role: string | null | undefined,
): Promise<boolean> {
  if (!(await responseTraceSessionEnabled())) return false;
  return capabilityAllowsRole("inspector.view", normalizePermissionRole(role));
}

export function responseTraceHeadersV2(
  trace: ResponseTraceV2 | null,
): Record<string, string> {
  if (!trace) return {};
  try {
    const encoded = Buffer.from(JSON.stringify(trace), "utf8").toString(
      "base64url",
    );
    if (
      !encoded ||
      Buffer.byteLength(encoded, "ascii") > MAX_RESPONSE_TRACE_HEADER_BYTES
    ) {
      return { "X-VS-Inspection-Status": "unavailable" };
    }
    return {
      "X-VS-Inspection": encoded,
      "X-VS-Inspection-Status": "available",
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Vary: "Authorization, Cookie",
    };
  } catch {
    return { "X-VS-Inspection-Status": "unavailable" };
  }
}

export function manualSearchResponseTraceV2({
  rid,
  route,
  searched,
  sourceCount,
  citedSourceCount = sourceCount,
  consultedSourceCount = sourceCount,
  prohibited = false,
  failed = false,
  fallbackToChat = false,
}: {
  rid: string;
  route: "trusted_health" | "current_news";
  searched: boolean;
  sourceCount: number;
  citedSourceCount?: number;
  consultedSourceCount?: number;
  prohibited?: boolean;
  failed?: boolean;
  fallbackToChat?: boolean;
}): ResponseTraceV2 {
  const responseRuntime =
    route === "current_news" ? "current_news_v1" : "trusted_web_v1";
  return {
    contract_version: "response_trace_v2",
    authorities: {
      identity: "supabase",
      routing: "verbalsage_server_v1",
      response_runtime: responseRuntime,
    },
    request: {
      request_id: rid,
      channel: "text",
      transcript_persistence: "skipped",
    },
    authorization: {
      actor_verification: "supabase_fresh_user_lookup",
      execution_authorization: "web_search.override",
      inspection_capability: "inspector.view",
      inspection_verification: "supabase_fresh_user_lookup",
    },
    routing: {
      search_mode: "manual_override",
      policy_version: SEARCH_DECISION_POLICY_VERSION,
      decision: prohibited ? "no_search" : "manual_override",
      reason_codes: [
        prohibited ? "search_prohibited_by_user" : "manual_override_authorized",
      ],
      policy_pack: route === "current_news" ? "current_news" : "health",
      selected_route: prohibited || fallbackToChat ? "normal_chat" : route,
      attempted_route: prohibited ? null : route,
      executed_external_web_access: searched,
      fallback_to_chat: fallbackToChat,
      budget: null,
    },
    execution: {
      web_searched: searched,
      source_count: sourceCount,
      cited_source_count: citedSourceCount,
      consulted_source_count: consultedSourceCount,
      validation: failed ? "failed" : "passed",
    },
    timings: null,
    response_inspection: null,
  };
}
