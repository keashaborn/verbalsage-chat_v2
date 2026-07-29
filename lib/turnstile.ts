import { randomUUID } from "crypto";
import "server-only";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const REQUEST_TIMEOUT_MS = 5_000;
const EXPECTED_ACTION = "request_access";
const EXPECTED_HOSTNAMES = new Set([
  "lifeswitch.com",
  "www.lifeswitch.com",
  "verbalsage.com",
  "www.verbalsage.com",
]);

type TurnstileResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

export type TurnstileVerificationResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "configuration"
        | "invalid_token"
        | "rejected"
        | "action"
        | "hostname"
        | "unavailable";
    };

export async function verifyAccessRequestTurnstile(input: {
  token: string;
  remoteIp: string;
}): Promise<TurnstileVerificationResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim() || "";
  if (!secret) return { ok: false, reason: "configuration" };

  const token = String(input.token || "").trim();
  if (!token || token.length > 2_048) {
    return { ok: false, reason: "invalid_token" };
  }

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  form.set("idempotency_key", randomUUID());
  if (input.remoteIp && input.remoteIp !== "unknown") {
    form.set("remoteip", input.remoteIp);
  }

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, reason: "unavailable" };

    const outcome = (await response.json()) as TurnstileResponse;
    if (!outcome?.success) return { ok: false, reason: "rejected" };
    if (outcome.action !== EXPECTED_ACTION) {
      return { ok: false, reason: "action" };
    }
    if (!outcome.hostname || !EXPECTED_HOSTNAMES.has(outcome.hostname)) {
      return { ok: false, reason: "hostname" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
