import { NextResponse } from "next/server";
import { getActorUserIdFromCookie } from "@/app/api/_auth/getActorUserId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const BRAINS_URL = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const url = `${BRAINS_URL}/telemetry/event`;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const actor = await getActorUserIdFromCookie();
  if (!actor) return new NextResponse("unauthorized", { status: 401 });

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-vs-actor-user-id": actor,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
