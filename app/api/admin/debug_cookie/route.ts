export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { requireCapability } from "@/app/api/_auth/requireCapability";
import {
  INSPECTOR_NO_STORE_HEADERS,
  inspectorSessionCookie,
  inspectorSessionCookieName,
  inspectorSessionEnabled,
} from "@/lib/inspectorSession";

export async function GET(req: Request) {
  const auth = await requireCapability(req, "inspector.view");
  if (!auth.ok) {
    return new Response(auth.msg, {
      status: auth.status,
      headers: INSPECTOR_NO_STORE_HEADERS,
    });
  }

  const jar = await cookies();
  const enabled = inspectorSessionEnabled(
    jar.get(inspectorSessionCookieName())?.value,
  );
  return Response.json(
    { ok: true, enabled },
    { headers: INSPECTOR_NO_STORE_HEADERS },
  );
}

export async function POST(req: Request) {
  const auth = await requireCapability(req, "inspector.view");
  if (!auth.ok) {
    return new Response(auth.msg, {
      status: auth.status,
      headers: INSPECTOR_NO_STORE_HEADERS,
    });
  }

  const res = new Response(JSON.stringify({ status: "ok" }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...INSPECTOR_NO_STORE_HEADERS,
    },
  });
  res.headers.append("Set-Cookie", inspectorSessionCookie(true));
  return res;
}

export async function DELETE(req: Request) {
  const auth = await requireCapability(req, "inspector.view");
  if (!auth.ok) {
    return new Response(auth.msg, {
      status: auth.status,
      headers: INSPECTOR_NO_STORE_HEADERS,
    });
  }

  const res = new Response(JSON.stringify({ status: "ok" }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...INSPECTOR_NO_STORE_HEADERS,
    },
  });
  res.headers.append("Set-Cookie", inspectorSessionCookie(false));
  return res;
}
