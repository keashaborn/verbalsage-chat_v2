import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import fs from "node:fs";

export const runtime = "nodejs";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

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

export async function GET() {
  if (!JWKS || !process.env.SUPABASE_ISSUER) {
    return NextResponse.json({ ok: false, error: "JWKS not configured" }, { status: 500 });
  }

  const jar = await cookies();
  const token = jar.get("vs_at")?.value;
  if (!token) return NextResponse.json({ ok: false, error: "no vs_at cookie" }, { status: 401 });

  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: process.env.SUPABASE_ISSUER });
    // Any authenticated user can request the WS token.
    // (Add tiering / allowlists here later if needed.)
    const role = (payload as any)?.app_metadata?.role || null;
    void role;

    const wsToken =
      readEnvFileToken("/etc/verbalsage/brains.env") ||
      process.env.VOICE_WS_TOKEN ||
      null;

    if (!wsToken) {
      return NextResponse.json({ ok: false, error: "VOICE_WS_TOKEN not configured" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, token: wsToken });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid token" }, { status: 401 });
  }
}
