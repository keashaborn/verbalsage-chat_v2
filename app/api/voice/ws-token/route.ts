import { NextResponse } from "next/server";
import fs from "node:fs";
import { getSupabaseUserIdFromRequest } from "@/app/api/_auth/supabaseUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readEnvFileToken(path: string): string | null {
  try {
    const txt = fs.readFileSync(path, "utf8");
    for (const line of txt.split("\n")) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      if (s.startsWith("VOICE_WS_TOKEN=")) {
        return s.slice("VOICE_WS_TOKEN=".length).trim();
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const user_id = await getSupabaseUserIdFromRequest(req);
  if (!user_id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const wsToken =
    readEnvFileToken("/etc/verbalsage/brains.env") ||
    process.env.VOICE_WS_TOKEN ||
    null;

  if (!wsToken) {
    return NextResponse.json({ ok: false, error: "VOICE_WS_TOKEN not configured" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, token: wsToken });
}
