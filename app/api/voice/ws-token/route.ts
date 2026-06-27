import { NextResponse } from "next/server";
import fs from "node:fs";
import { requireCapability } from "@/app/api/_auth/requireCapability";

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
  const cap = await requireCapability(req, "voice.realtime_token");
  if (!cap.ok) {
    return NextResponse.json({ ok: false, error: cap.msg }, { status: cap.status });
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
