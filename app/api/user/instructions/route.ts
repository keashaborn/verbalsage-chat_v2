export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null;

async function getUserIdFromCookie(): Promise<string | null> {
  if (!JWKS || !process.env.SUPABASE_ISSUER) return null;

  const jar = await cookies();
  const token = jar.get("vs_at")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: process.env.SUPABASE_ISSUER });
    return (payload?.sub as string) || null;
  } catch {
    return null;
  }
}

async function getUserIdOrDev(): Promise<string | null> {
  const real = await getUserIdFromCookie();
  if (real) return real;

  // Dev escape hatch (matches /api/chat behavior)
  const allowGuest = process.env.VS_DEV_ALLOW_GUEST === "1";
  const devTestUser = String(process.env.VS_DEV_TEST_USER_ID || "").trim();
  if (allowGuest && devTestUser) return devTestUser;

  return null;
}


function pickVantageId(args: { bodyVid?: any; cookieVid?: any }): string {
  const rawBody = String(args.bodyVid || "").trim().slice(0, 64);
  const rawCookie = String(args.cookieVid || "").trim().slice(0, 64);

  const raw = rawBody || rawCookie;
  if (!raw) return "RESSE";

  const t = raw.toLowerCase();
  if (t === "default") return "RESSE";
  return raw.toUpperCase();
}

function parseInstructionsText(text: string): { about_me: string; how_to_respond: string } {
  const t = String(text || "");
  const aboutMarker = "About user:";
  const respondMarker = "How to respond:";

  const iAbout = t.indexOf(aboutMarker);
  const iResp = t.indexOf(respondMarker);

  if (iAbout === -1 && iResp === -1) {
    return { about_me: t.trim(), how_to_respond: "" };
  }

  let about = "";
  let respond = "";

  if (iAbout !== -1 && iResp !== -1 && iResp > iAbout) {
    about = t.slice(iAbout + aboutMarker.length, iResp).trim();
    respond = t.slice(iResp + respondMarker.length).trim();
  } else if (iAbout !== -1) {
    about = t.slice(iAbout + aboutMarker.length).trim();
  } else if (iResp !== -1) {
    respond = t.slice(iResp + respondMarker.length).trim();
  }

  // strip common "(blank)" placeholders
  if (about === "(blank)") about = "";
  if (respond === "(blank)") respond = "";

  return { about_me: about, how_to_respond: respond };
}

type ReqBody = {
  about_me?: string;
  how_to_respond?: string;
  base_importance?: number;
  tags?: string[];
  vantage_id?: string; // optional; cookie is authoritative by default
};

export async function GET() {
  const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";

  const user_id = await getUserIdOrDev();
  if (!user_id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const jar = await cookies();
  const vantage_id = pickVantageId({ cookieVid: jar.get("vs_vantage_id")?.value });

  const r = await fetch(
    `${BRAINS_URL}/cards/${encodeURIComponent(user_id)}?vantage_id=${encodeURIComponent(
      vantage_id
    )}&kinds=user_instructions&limit=1`,
    { method: "GET" }
  );

  const raw = await r.text().catch(() => "");
  if (!r.ok) {
    return NextResponse.json({ error: `brains HTTP ${r.status}`, details: raw }, { status: 502 });
  }

  let about_me = "";
  let how_to_respond = "";
  let updated_at: string | null = null;

  try {
    const data = JSON.parse(raw);
    const it = Array.isArray(data?.items) && data.items.length ? data.items[0] : null;
    const txt = String(it?.text || "");
    const parsed = parseInstructionsText(txt);
    about_me = parsed.about_me;
    how_to_respond = parsed.how_to_respond;
    updated_at = it?.updated_at ? String(it.updated_at) : it?.created_at ? String(it.created_at) : null;
  } catch {
    // ignore parse errors; return blanks
  }

  return NextResponse.json({ ok: true, vantage_id, about_me, how_to_respond, updated_at }, { status: 200 });
}

export async function POST(req: Request) {
  const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";

  const user_id = await getUserIdOrDev();
  if (!user_id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const jar = await cookies();
  const body = (await req.json().catch(() => ({}))) as ReqBody;

  const vantage_id = pickVantageId({ bodyVid: body.vantage_id, cookieVid: jar.get("vs_vantage_id")?.value });

  const aboutMe = String(body.about_me || "").trim();
  const howToRespond = String(body.how_to_respond || "").trim();

  const text =
    `About user:\n${aboutMe || "(blank)"}\n\n` +
    `How to respond:\n${howToRespond || "(blank)"}`;

  const base_importance =
    Number.isFinite(Number(body.base_importance)) ? Number(body.base_importance) : 0.9;

  const tags = Array.isArray(body.tags) && body.tags.length ? body.tags : ["card", "user_instructions"];

  const r = await fetch(
    `${BRAINS_URL}/cards/${encodeURIComponent(user_id)}?vantage_id=${encodeURIComponent(vantage_id)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "user_instructions",
        topic_key: "__singleton__",
        tags,
        base_importance,
        text,
      }),
    }
  );

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    return NextResponse.json({ error: `brains HTTP ${r.status}`, details: txt }, { status: 502 });
  }

  return new NextResponse(txt, { status: 200, headers: { "Content-Type": "application/json" } });
}
