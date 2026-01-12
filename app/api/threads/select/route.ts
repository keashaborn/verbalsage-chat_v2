import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { cookieSecure } from "@/lib/cookieSecure";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const thread_id = String(body?.thread_id || "").trim();
  if (!thread_id) return NextResponse.json({ error: "missing thread_id" }, { status: 400 });

  const res = NextResponse.json({ ok: true, thread_id });
  res.cookies.set("vs_tid", thread_id, {
    httpOnly: true,
    secure: await cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
