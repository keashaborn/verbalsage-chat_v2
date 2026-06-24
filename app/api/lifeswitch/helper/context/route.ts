import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getLifeSwitchOwnerUserId, unauthorizedLifeSwitch } from "@/app/api/lifeswitch/_owner";
import { buildLifeSwitchHelperContext } from "@/lib/lifeswitch/helperContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rid = req.headers.get("x-request-id") || randomUUID();

  const owner_user_id = await getLifeSwitchOwnerUserId(req);
  if (!owner_user_id) return unauthorizedLifeSwitch(rid);

  const inUrl = new URL(req.url);

  try {
    const context = await buildLifeSwitchHelperContext({
      owner_user_id,
      rid,
      route: String(inUrl.searchParams.get("route") || "/lifeswitch").trim(),
      days: Number(inUrl.searchParams.get("days") || 14),
      today: String(inUrl.searchParams.get("today") || "").trim() || undefined,
      startDay: String(inUrl.searchParams.get("start_day") || "").trim() || undefined,
    });

    return new Response(JSON.stringify(context, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-request-id": rid,
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "lifeswitch_context_failed",
        detail: String(e?.message || e),
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-request-id": rid,
        },
      },
    );
  }
}
