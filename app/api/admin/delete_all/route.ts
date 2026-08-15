export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import { executeAdminConversationErasure } from "@/app/api/_brains/conversationErasureRequest";
import { cookieSecure } from "@/lib/cookieSecure";
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

  const auth = await requireFreshCapability(req, "user_data.delete");
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.msg },
      { status: auth.status, headers: noStoreHeaders(requestId) },
    );
  }

  if (process.env.VS_ALLOW_DELETE_ALL !== "true") {
    return NextResponse.json(
      { error: "delete_all_disabled" },
      { status: 403, headers: noStoreHeaders(requestId) },
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

  const operationId = randomUUID();
  const result = await executeAdminConversationErasure({
    requestId,
    userId: user_id,
    authorization,
    operationId,
    selector: { selectorKind: "all_conversations" },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code },
      { status: result.status, headers: noStoreHeaders(requestId) },
    );
  }

  const res = NextResponse.json(
    {
      status: "ok",
      operation_id: result.operationId,
      state: "completed",
      target_count: result.targetCount,
    },
    { status: 200, headers: noStoreHeaders(requestId) },
  );

  const secure = await cookieSecure();
  res.cookies.set("vs_tid", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
