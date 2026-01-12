import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  const jar = await cookies();
  const tid = jar.get("vs_tid")?.value || null;
  return NextResponse.json({ thread_id: tid });
}
