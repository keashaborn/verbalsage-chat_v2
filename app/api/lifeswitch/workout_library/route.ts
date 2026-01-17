export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  try {
    const p = path.join(process.cwd(), "public", "lifeswitch", "workout_library.json");
    const raw = await readFile(p, "utf-8");
    // Validate JSON so we don't serve broken content silently
    const j = JSON.parse(raw);

    return new NextResponse(JSON.stringify(j), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
}
