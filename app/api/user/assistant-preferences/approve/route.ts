export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  apiValue,
  preferenceHeaders,
  preferencesRequestContext,
  upstreamError,
} from "../_shared";

export async function POST(req: Request): Promise<NextResponse> {
  const context = await preferencesRequestContext(req);
  if (context instanceof NextResponse) return context;
  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    !Number.isInteger(body.expected_revision) ||
    typeof body.candidate_id !== "string" ||
    !body.candidate_id.trim()
  ) {
    return NextResponse.json(
      { error: "invalid_preference_approval_request" },
      { status: 400, headers: { "x-request-id": context.rid } },
    );
  }
  const response = await fetch(
    `${context.brains}/assistant-preferences/${encodeURIComponent(context.owner)}/approve`,
    {
      method: "POST",
      headers: preferenceHeaders(context),
      body: JSON.stringify({
        expected_revision: body.expected_revision,
        candidate_id: body.candidate_id,
      }),
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
      { error: "invalid_preference_approval_response" },
      { status: 502, headers: { "x-request-id": context.rid } },
    );
  }
}
