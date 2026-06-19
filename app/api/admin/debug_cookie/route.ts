export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAdmin } from "../_auth";

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return new Response(auth.msg, { status: auth.status });

  const secret = (process.env.VS_DEBUG_TOKEN || "").trim();
  if (!secret) return new Response("VS_DEBUG_TOKEN not set", { status: 500 });

  const res = new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

  res.headers.append(
    "Set-Cookie",
    `vs_debug_token=${encodeURIComponent(secret)}; Path=/; Max-Age=${60 * 60 * 6}; SameSite=Lax`
  );

  return res;
}
