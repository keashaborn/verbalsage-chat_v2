export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash, randomUUID } from "crypto";
import {
  getFreshSupabaseAuthContextFromRequest,
  getSupabaseBearerAuthorizationFromRequest,
} from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import { productTierAllows } from "@/lib/productEntitlements";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/;
const MAX_ATTACHMENT_BYTES = 49_152;
const MEDIA_TYPES = new Set(["text/plain", "text/markdown"]);

function requestId(req: Request): string {
  const supplied = String(req.headers.get("x-request-id") || "").trim();
  return supplied && supplied.length <= 128 ? supplied : randomUUID();
}

function validFilename(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= 160 &&
    !/[\/\\\u0000\r\n]/.test(value)
  );
}

export async function POST(req: Request) {
  const rid = requestId(req);
  const auth = await getFreshSupabaseAuthContextFromRequest(req);
  const authorization = getSupabaseBearerAuthorizationFromRequest(req);
  if (!auth || !authorization || !UUID_RE.test(auth.user_id)) {
    return new Response("unauthorized", {
      status: 401,
      headers: { "x-request-id": rid },
    });
  }
  if (!productTierAllows(auth.app_metadata.product_tier, "verbal_sage")) {
    return new Response("product access required", {
      status: 403,
      headers: { "x-request-id": rid },
    });
  }

  const body = await req.json().catch(() => null);
  const threadId = String(body?.thread_id || "").trim();
  const filename = String(body?.filename || "").trim();
  const mediaType = String(body?.media_type || "").trim().toLowerCase();
  const content = typeof body?.content === "string" ? body.content : "";
  const contentSha256 = String(body?.content_sha256 || "").trim();
  const raw = Buffer.from(content, "utf8");
  const exactHash = createHash("sha256").update(raw).digest("hex");
  if (
    !UUID_RE.test(threadId) ||
    !validFilename(filename) ||
    !MEDIA_TYPES.has(mediaType) ||
    raw.length < 1 ||
    raw.length > MAX_ATTACHMENT_BYTES ||
    !SHA256_RE.test(contentSha256) ||
    contentSha256 !== exactHash
  ) {
    return new Response("invalid attachment", {
      status: 400,
      headers: { "x-request-id": rid },
    });
  }

  const brains = process.env.BRAINS_URL || "http://172.31.32.171:8088";
  const upstream = await fetch(`${brains}/attachments`, {
    method: "POST",
    headers: brainsUpstreamHeaders(rid, auth.user_id, {
      authorization,
      "content-type": "application/json",
    }),
    body: JSON.stringify({
      user_id: auth.user_id,
      thread_id: threadId,
      filename,
      media_type: mediaType,
      content,
      content_sha256: contentSha256,
    }),
    cache: "no-store",
  });
  const responseBody = await upstream.text().catch(() => "");
  return new Response(responseBody || "Attachment service unavailable", {
    status: upstream.status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "x-request-id": upstream.headers.get("x-request-id") || rid,
    },
  });
}
