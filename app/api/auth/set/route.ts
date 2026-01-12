import { NextResponse } from "next/server";
import { cookieSecure } from "@/lib/cookieSecure";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const access_token = body?.access_token as string | undefined;
  const refresh_token = body?.refresh_token as string | undefined;
  const expires_at = body?.expires_at as number | undefined; // seconds since epoch

  if (!access_token) {
    return NextResponse.json({ error: "missing access_token" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const maxAge = expires_at && expires_at > now ? expires_at - now : 60 * 60;

  const res = NextResponse.json({ ok: true });

  res.cookies.set("vs_at", access_token, {
    httpOnly: true,
    secure: await cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  if (refresh_token) {
    res.cookies.set("vs_rt", refresh_token, {
      httpOnly: true,
      secure: await cookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return res;
}
