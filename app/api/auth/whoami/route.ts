import { NextResponse } from "next/server";
import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sub = await getSupabaseUserIdFromRequest(req);

  if (!sub) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, sub });
}
