import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cookieSecure } from "@/lib/cookieSecure";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const user_id = String(body?.user_id || "").trim();
  const title = String(body?.title || "New chat").trim() || "New chat";

  if (!user_id) return NextResponse.json({ error: "missing user_id" }, { status: 400 });

  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";

  const r = await fetch(`${BRAINS}/threads/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, title }),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return NextResponse.json({ error: `brains HTTP ${r.status}`, details: txt }, { status: 502 });
  }

  const data: any = await r.json().catch(() => ({}));
  const thread_id = String(data?.thread_id || "").trim();
  if (!thread_id) return NextResponse.json({ error: "brains missing thread_id" }, { status: 502 });

  const res = NextResponse.json(data);

  // store active thread cookie (per device/session)
  res.cookies.set("vs_tid", thread_id, {
    httpOnly: true,
    secure: await cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30d
  });

  return res;
}
