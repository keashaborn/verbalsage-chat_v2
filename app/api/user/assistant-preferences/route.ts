export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";

function requestId(req: Request): string {
  const raw = (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    ""
  ).trim();
  return (raw || crypto.randomUUID()).slice(0, 128);
}

async function ownerId(req: Request): Promise<string | null> {
  const owner = await getSupabaseUserIdFromRequest(req);
  if (owner) return owner;
  if (process.env.VS_DEV_ALLOW_GUEST === "1") {
    return String(process.env.VS_DEV_TEST_USER_ID || "").trim() || null;
  }
  return null;
}

function apiValue(raw: any) {
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
  };
}

async function upstream(
  req: Request,
  method: "GET" | "PUT",
): Promise<NextResponse> {
  const rid = requestId(req);
  const owner = await ownerId(req);
  if (!owner) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "x-request-id": rid } },
    );
  }
  const brains = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const body =
    method === "PUT" ? await req.json().catch(() => null) : undefined;
  if (method === "PUT" && (!body || typeof body !== "object")) {
    return NextResponse.json(
      { error: "invalid_preferences" },
      { status: 400, headers: { "x-request-id": rid } },
    );
  }
  const payload =
    method === "PUT"
      ? {
          expected_revision: body.expected_revision,
          assistant_name: body.assistant_name || null,
          nickname: body.nickname || null,
          occupation: body.occupation || null,
          more_about_you: body.more_about_you || null,
          custom_instructions: body.custom_instructions || null,
          response_length: body.response_length,
          technical_depth: body.technical_depth,
          response_format: body.format,
          conversation_style: body.conversation_style,
        }
      : undefined;
  const response = await fetch(
    `${brains}/assistant-preferences/${encodeURIComponent(owner)}`,
    {
      method,
      headers: brainsUpstreamHeaders(rid, owner, {
        ...(method === "PUT" ? { "Content-Type": "application/json" } : {}),
      }),
      body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store",
    },
  );
  const raw = await response.text().catch(() => "");
  if (!response.ok) {
    let detail = "preferences_unavailable";
    try {
      detail = String(JSON.parse(raw)?.detail || detail);
    } catch {}
    return NextResponse.json(
      { error: detail },
      { status: response.status, headers: { "x-request-id": rid } },
    );
  }
  try {
    return NextResponse.json(apiValue(JSON.parse(raw)), {
      headers: { "x-request-id": rid },
    });
  } catch {
    return NextResponse.json(
      { error: "invalid_preferences_response" },
      { status: 502, headers: { "x-request-id": rid } },
    );
  }
}

export async function GET(req: Request) {
  return upstream(req, "GET");
}

export async function PUT(req: Request) {
  return upstream(req, "PUT");
}
