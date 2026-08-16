export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import { executeChatHistoryClear } from "@/app/api/_brains/chatHistoryClearRequest";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

function getRequestId(req: Request): string {
  const raw = (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    ""
  ).trim();
  if (raw && raw.length <= 128) return raw;
  return randomUUID();
}

function noStoreHeaders(requestId: string): Record<string, string> {
  return {
    "cache-control": "private, no-store, max-age=0, must-revalidate",
    "x-request-id": requestId,
  };
}

export async function DELETE(req: Request) {
  const requestId = getRequestId(req);

  const auth = await requireFreshCapability(req, "user_data.forget_recent");
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.msg },
      { status: auth.status, headers: noStoreHeaders(requestId) },
    );
  }

  const user_id = String((auth as any).payload?.sub || "");
  const authorization = (req.headers.get("authorization") || "").trim();
  if (!user_id || !authorization) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: noStoreHeaders(requestId) },
    );
  }

  const url = new URL(req.url);
  const minutes = Number(url.searchParams.get("minutes") || "60");
  const allowedMinutes = new Set([60, 1440, 10080, 43200]);
  if (!Number.isSafeInteger(minutes) || !allowedMinutes.has(minutes)) {
    return NextResponse.json(
      { error: "invalid_recent_window" },
      { status: 400, headers: noStoreHeaders(requestId) },
    );
  }

  const result = await executeChatHistoryClear({
    requestId,
    userId: user_id,
    authorization,
    selector: {
      scope: "recent",
      recentWindowSeconds: minutes * 60,
    },
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.code },
      { status: result.status, headers: noStoreHeaders(requestId) },
    );
  }

  return NextResponse.json(
    {
      status: "ok",
      memory_retained: true,
      deleted_message_count: result.deletedMessageCount,
      deleted_thread_count: result.deletedThreadCount,
    },
    { status: 200, headers: noStoreHeaders(requestId) },
  );
}
