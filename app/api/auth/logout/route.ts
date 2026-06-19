import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Legacy endpoint. Supabase client signOut is the real logout mechanism now.
export async function POST() {
  return NextResponse.json({ ok: true, legacy: true });
}
