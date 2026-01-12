import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODELS = [
  "gpt-5.2",
  "gpt-5.1",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
  "xai:grok-3",
  "xai:grok-3-mini",
  "xai:grok-4-0709",
  "xai:grok-4-1-fast-non-reasoning",
  "xai:grok-4-1-fast-reasoning",
  "xai:grok-4-fast-non-reasoning",
  "xai:grok-4-fast-reasoning",
  "xai:grok-code-fast-1",
  "xai:grok-2-vision-1212",
  "xai:grok-2-image-1212",
];

export async function GET() {
  return NextResponse.json({ models: MODELS });
}
