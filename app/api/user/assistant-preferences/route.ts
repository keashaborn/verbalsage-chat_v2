export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  apiValue,
  preferenceHeaders,
  preferencesRequestContext,
  upstreamError,
} from "./_shared";

async function upstream(
  req: Request,
  method: "GET" | "PUT",
): Promise<NextResponse> {
  const context = await preferencesRequestContext(req);
  if (context instanceof NextResponse) return context;
  const body =
    method === "PUT" ? await req.json().catch(() => null) : undefined;
  if (method === "PUT" && (!body || typeof body !== "object")) {
    return NextResponse.json(
      { error: "invalid_preferences" },
      { status: 400, headers: { "x-request-id": context.rid } },
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
    `${context.brains}/assistant-preferences/${encodeURIComponent(context.owner)}`,
    {
      method,
      headers: preferenceHeaders(context),
      body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store",
    },
  );
  const raw = await response.text().catch(() => "");
  if (!response.ok) {
    return upstreamError(raw, response.status, context.rid);
  }
  try {
    return NextResponse.json(apiValue(JSON.parse(raw)), {
      headers: { "x-request-id": context.rid },
    });
  } catch {
    return NextResponse.json(
      { error: "invalid_preferences_response" },
      { status: 502, headers: { "x-request-id": context.rid } },
    );
  }
}

export async function GET(req: Request) {
  return upstream(req, "GET");
}

export async function PUT(req: Request) {
  return upstream(req, "PUT");
}
