import { NextResponse } from "next/server";
import { cookieSecure } from "@/lib/cookieSecure";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // clear cookies
  res.cookies.set("vs_at", "", {
    httpOnly: true,
    secure: await cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  res.cookies.set("vs_rt", "", {
    httpOnly: true,
    secure: await cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}
