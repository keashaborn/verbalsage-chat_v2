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
];

export async function GET() {
  return NextResponse.json({ models: MODELS });
}
