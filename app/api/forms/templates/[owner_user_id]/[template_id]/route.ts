import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ owner_user_id: string; template_id: string }> }
) {
  const raw = (req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "").trim();
  const requestId = (raw || crypto.randomUUID()).slice(0, 128);

  // Safety gate (match your delete_all pattern)
  if (process.env.VS_ALLOW_FORMS_DELETE !== "true") {
    return NextResponse.json({ error: "forms delete disabled" }, { status: 403, headers: { "x-request-id": requestId } });
  }

  try {
    const { owner_user_id, template_id } = await context.params;

    const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";

    // forward querystring (needs confirm=true)
    const qs = req.nextUrl.searchParams.toString();
    const url = `${BRAINS}/forms/templates/${encodeURIComponent(owner_user_id)}/${encodeURIComponent(template_id)}${qs ? `?${qs}` : ""}`;

    const r = await fetch(url, {
      method: "DELETE",
      cache: "no-store",
      headers: { "x-request-id": requestId },
    });

    const text = await r.text();
    const rid = r.headers.get("x-request-id") || requestId;

    return new NextResponse(text, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") || "application/json",
        "x-request-id": rid,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 500, headers: { "x-request-id": requestId } }
    );
  }
}
