export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import { executeChatHistoryClear } from "@/app/api/_brains/chatHistoryClearRequest";
import { cookieSecure } from "@/lib/cookieSecure";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

function requestId(req: Request): string {
  const value = (req.headers.get("x-request-id") || "").trim();
  return value && value.length <= 128 ? value : randomUUID();
}

function noStore(id: string): Record<string, string> {
  return {
    "cache-control": "private, no-store, max-age=0, must-revalidate",
    "x-request-id": id,
  };
}

export async function DELETE(req: Request) {
  const id = requestId(req);
  const auth = await requireFreshCapability(req, "user_data.delete");
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.msg },
      { status: auth.status, headers: noStore(id) },
    );
  }
  if (process.env.VS_ALLOW_DELETE_ALL !== "true") {
    return NextResponse.json(
      { error: "clear_chat_history_disabled" },
      { status: 403, headers: noStore(id) },
    );
  }
  const userId = String((auth as any).payload?.sub || "");
  const authorization = (req.headers.get("authorization") || "").trim();
  if (!userId || !authorization) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: noStore(id) },
    );
  }

  const result = await executeChatHistoryClear({
    requestId: id,
    userId,
    authorization,
    selector: { scope: "all" },
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.code },
      { status: result.status, headers: noStore(id) },
    );
  }

  const response = NextResponse.json(
    {
      status: "ok",
      memory_retained: true,
      deleted_message_count: result.deletedMessageCount,
      deleted_thread_count: result.deletedThreadCount,
    },
    { status: 200, headers: noStore(id) },
  );
  response.cookies.set("vs_tid", "", {
    httpOnly: true,
    secure: await cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
