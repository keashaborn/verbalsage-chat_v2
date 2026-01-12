export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";

export async function DELETE(_req: NextRequest, context: { params: Promise<{ thread_id: string }> }) {
  const BRAINS = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const { thread_id } = await context.params;

  const r = await fetch(`${BRAINS}/threads/${encodeURIComponent(thread_id)}`, { method: "DELETE" });
  const txt = await r.text().catch(() => "");
  if (!r.ok) return new Response(txt || `Brains HTTP ${r.status}`, { status: 502 });

  return new Response(txt, { status: 200, headers: { "Content-Type": "application/json" } });
}
