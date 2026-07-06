import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function brainsUrl(): string {
  const u = process.env.BRAINS_URL;
  if (!u) throw new Error("BRAINS_URL missing");
  return u.replace(/\/+$/, "");
}

export async function GET(req: Request) {
  const inUrl = new URL(req.url);
  const upstream = new URL(`${brainsUrl()}/catalog/foods/usda/barcode`);
  upstream.search = inUrl.search;

  try {
    const r = await fetch(upstream.toString(), { cache: "no-store" });
    const text = await r.text();

    return new NextResponse(text, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") || "application/json",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "brains_unreachable", detail: String(e) },
      { status: 502 }
    );
  }
}
