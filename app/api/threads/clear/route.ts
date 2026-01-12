import { NextResponse } from "next/server";
import { cookieSecure } from "@/lib/cookieSecure";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("vs_tid", "", {
    httpOnly: true,
    secure: await cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
