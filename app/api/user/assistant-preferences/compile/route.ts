export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  candidateValue,
  preferenceHeaders,
  preferencesRequestContext,
  upstreamError,
} from "../_shared";

const MAX_PREFERENCE_NARRATIVE_CHARS = 8000;

export async function POST(req: Request): Promise<NextResponse> {
  const context = await preferencesRequestContext(req);
  if (context instanceof NextResponse) return context;
  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    !Number.isInteger(body.expected_revision) ||
    typeof body.narrative !== "string" ||
    body.narrative.length > MAX_PREFERENCE_NARRATIVE_CHARS
  ) {
    return NextResponse.json(
      { error: "invalid_preference_compilation_request" },
      { status: 400, headers: { "x-request-id": context.rid } },
    );
  }
  const response = await fetch(
    `${context.brains}/assistant-preferences/${encodeURIComponent(context.owner)}/compile`,
    {
      method: "POST",
      headers: preferenceHeaders(context),
      body: JSON.stringify({
        expected_revision: body.expected_revision,
        narrative: body.narrative,
      }),
      cache: "no-store",
    },
  );
  const raw = await response.text().catch(() => "");
  if (!response.ok) {
    return upstreamError(raw, response.status, context.rid);
  }
  try {
    const candidate = candidateValue(JSON.parse(raw));
    if (!candidate.candidate_id || candidate.source_revision < 0) {
      throw new Error("invalid candidate");
    }
    return NextResponse.json(candidate, {
      headers: { "x-request-id": context.rid },
    });
  } catch {
    return NextResponse.json(
      { error: "invalid_preference_compilation_response" },
      { status: 502, headers: { "x-request-id": context.rid } },
    );
  }
}
