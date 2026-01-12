import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
    const url = `${BRAINS}/forms/publish`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await r.text();

    return new NextResponse(text, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") || "application/json",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
