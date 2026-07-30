import { NextResponse } from "next/server";
import {
  getSupabaseBearerAuthorizationFromRequest,
  getSupabaseUserIdFromRequest,
} from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

export type PreferencesRequestContext = {
  authorization: string;
  brains: string;
  owner: string;
  rid: string;
};

export function requestId(req: Request): string {
  const raw = (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    ""
  ).trim();
  return (raw || crypto.randomUUID()).slice(0, 128);
}

export async function preferencesRequestContext(
  req: Request,
): Promise<PreferencesRequestContext | NextResponse> {
  const rid = requestId(req);
  const authenticatedOwner = await getSupabaseUserIdFromRequest(req);
  const owner =
    authenticatedOwner ||
    (process.env.VS_DEV_ALLOW_GUEST === "1"
      ? String(process.env.VS_DEV_TEST_USER_ID || "").trim()
      : "");
  const authorization = getSupabaseBearerAuthorizationFromRequest(req);
  if (!owner || !authorization) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "x-request-id": rid } },
    );
  }
  return {
    authorization,
    brains: process.env.BRAINS_URL || "http://172.31.32.171:8088",
    owner,
    rid,
  };
}

export function preferenceHeaders(context: PreferencesRequestContext) {
  return brainsUpstreamHeaders(context.rid, context.owner, {
    authorization: context.authorization,
    "Content-Type": "application/json",
  });
}

export function apiValue(raw: any) {
  return {
    contract_version: raw?.contract_version,
    revision: Number.isInteger(raw?.revision) ? raw.revision : 0,
    updated_at: raw?.updated_at || null,
    assistant_name: raw?.assistant_name || "",
    nickname: raw?.nickname || "",
    occupation: raw?.occupation || "",
    more_about_you: raw?.more_about_you || "",
    custom_instructions: raw?.custom_instructions || "",
    response_length: raw?.response_length || "balanced",
    technical_depth: raw?.technical_depth || "balanced",
    format: raw?.response_format || "auto",
    conversation_style: raw?.conversation_style || "natural",
    compilation: {
      status: raw?.compilation?.status === "active" ? "active" : "none",
      summary: Array.isArray(raw?.compilation?.summary)
        ? raw.compilation.summary.map(String)
        : [],
      not_applied: Array.isArray(raw?.compilation?.not_applied)
        ? raw.compilation.not_applied.map(String)
        : [],
      compiled_at: raw?.compilation?.compiled_at || null,
    },
  };
}

export function candidateValue(raw: any) {
  return {
    contract_version: raw?.contract_version,
    candidate_id: String(raw?.candidate_id || ""),
    source_revision: Number.isInteger(raw?.source_revision)
      ? raw.source_revision
      : -1,
    status: String(raw?.status || ""),
    summary: Array.isArray(raw?.summary) ? raw.summary.map(String) : [],
    not_applied: Array.isArray(raw?.not_applied)
      ? raw.not_applied.map(String)
      : [],
    proposed: {
      response_length: raw?.proposed?.response_length || null,
      technical_depth: raw?.proposed?.technical_depth || null,
      format: raw?.proposed?.format || null,
      conversation_style: raw?.proposed?.conversation_style || null,
    },
    expires_at: raw?.expires_at || null,
  };
}

export function upstreamError(
  raw: string,
  status: number,
  rid: string,
): NextResponse {
  let detail = "preferences_unavailable";
  try {
    detail = String(JSON.parse(raw)?.detail || detail);
  } catch {}
  return NextResponse.json(
    { error: detail },
    { status, headers: { "x-request-id": rid } },
  );
}
