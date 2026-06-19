import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Legacy endpoint. Browser identity now uses Supabase bearer tokens.
export async function POST() {
  return NextResponse.json({ ok: true, legacy: true });
}
