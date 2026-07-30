export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import {
  getFreshSupabaseAuthContextFromRequest,
  getSupabaseBearerAuthorizationFromRequest,
} from "@/app/api/_auth/supabaseUser";
import { brainsUpstreamHeaders } from "@/app/api/_brains/headers";
import {
  BRAINS_RESPONSE_TIMEOUT_MS,
  isAbortLike,
  requestDeadlineSignal,
} from "@/lib/requestDeadline";
import { buildSageHelperPrompt } from "@/lib/lifeswitch/sage/helperPrompt";
import {
  parseSageHelperRequest,
  SAGE_HELPER_MAX_BODY_BYTES,
} from "@/lib/lifeswitch/sage/helperRequest";
import { buildNutritionLogSageContext } from "@/lib/lifeswitch/sage/nutritionLogContext";
import { resolveSagePageContract } from "@/lib/lifeswitch/sage/pageRegistry";
import { buildTrainingCalendarSageContext } from "@/lib/lifeswitch/sage/trainingCalendarContext";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requestId(req: Request): string {
  const supplied = String(
    req.headers.get("x-request-id") ||
      req.headers.get("x-correlation-id") ||
      "",
  ).trim();
  return supplied && supplied.length <= 128 ? supplied : randomUUID();
}

function responseHeaders(requestIdValue: string): Record<string, string> {
  return {
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    "Content-Type": "text/plain; charset=utf-8",
    Pragma: "no-cache",
    Expires: "0",
    "x-request-id": requestIdValue,
  };
}

function errorResponse(
  status: number,
  requestIdValue: string,
  message: string,
): Response {
  return new Response(message, {
    status,
    headers: responseHeaders(requestIdValue),
  });
}

function ownerTimezone(req: Request): string | null {
  const timezone = String(
    req.headers.get("x-lifeswitch-owner-timezone") || "UTC",
  ).trim();
  if (!timezone || timezone.length > 80) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<Response> {
  const rid = requestId(req);
  const declaredLength = Number(req.headers.get("content-length") || "0");
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > SAGE_HELPER_MAX_BODY_BYTES
  ) {
    return errorResponse(413, rid, "Helper request is too large");
  }

  const auth = await getFreshSupabaseAuthContextFromRequest(req);
  const authorization = getSupabaseBearerAuthorizationFromRequest(req);
  if (!auth || !authorization || !UUID_RE.test(auth.user_id)) {
    return errorResponse(401, rid, "unauthorized");
  }

  const raw = await req.text().catch(() => "");
  const parsed = parseSageHelperRequest(raw);
  if (!parsed.ok) {
    return errorResponse(parsed.status, rid, parsed.code);
  }

  const matched = resolveSagePageContract(parsed.value.route);
  if (!matched) {
    return errorResponse(404, rid, "No server-owned helper contract");
  }

  const timezone = ownerTimezone(req);
  if (!timezone) {
    return errorResponse(422, rid, "invalid_owner_timezone");
  }

  const contextInput = {
    actorUserId: auth.user_id,
    targetUserId: parsed.value.targetUserId,
    requestId: rid,
    timezone,
    signal: req.signal,
  };
  const contextResult =
    matched.contract.pageId === "nutrition.log"
      ? await buildNutritionLogSageContext(contextInput)
      : matched.contract.pageId === "training.calendar"
        ? await buildTrainingCalendarSageContext(contextInput)
        : null;
  if (!contextResult) {
    return errorResponse(404, rid, "No server-owned helper contract");
  }
  if (!contextResult.ok) {
    return errorResponse(
      contextResult.status,
      rid,
      "Page data is not authorized",
    );
  }

  let message: string;
  try {
    message = buildSageHelperPrompt(
      matched.contract,
      contextResult.context,
      parsed.value.question,
    );
  } catch {
    return errorResponse(413, rid, "Helper context is too large");
  }

  const brains = (
    process.env.BRAINS_URL || "http://172.31.32.171:8088"
  ).replace(/\/+$/, "");
  try {
    const upstream = await fetch(`${brains}/lifeswitch/sage/query`, {
      method: "POST",
      headers: brainsUpstreamHeaders(rid, auth.user_id, {
        authorization,
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        user_id: auth.user_id,
        contract_id: matched.contract.pageId,
        contract_version: matched.contract.contractVersion,
        message,
      }),
      cache: "no-store",
      signal: requestDeadlineSignal(BRAINS_RESPONSE_TIMEOUT_MS, req.signal),
    });
    const rawResponse = await upstream.text().catch(() => "");
    if (!upstream.ok) {
      return errorResponse(
        upstream.status === 504 ? 504 : 502,
        rid,
        upstream.status === 504
          ? "Helper response timed out"
          : "Helper response unavailable",
      );
    }

    let answer = "";
    let answerId = "";
    try {
      const payload = JSON.parse(rawResponse);
      answer = String(payload?.answer || "").trim();
      answerId = String(payload?.answer_id || "").trim();
    } catch {
      return errorResponse(502, rid, "Invalid helper response");
    }
    if (!answer) return errorResponse(502, rid, "Empty helper response");

    return new Response(answer, {
      status: 200,
      headers: {
        ...responseHeaders(rid),
        "X-VS-Sage-Contract": matched.contract.pageId,
        "X-VS-Sage-Contract-Version": matched.contract.contractVersion,
        "X-VS-Sage-Page-State":
          contextResult.context.active_state_ids.join(","),
        "X-VS-Sage-Persistence": "skipped",
        "X-VS-Sage-Memory": "disabled",
        "X-VS-Sage-FM": "disabled",
        "X-VS-Sage-Web-Search": "disabled",
        ...(UUID_RE.test(answerId) ? { "X-VS-Answer-Id": answerId } : {}),
      },
    });
  } catch (error) {
    return errorResponse(
      isAbortLike(error) ? 504 : 502,
      rid,
      isAbortLike(error)
        ? "Helper response timed out"
        : "Helper response unavailable",
    );
  }
}
