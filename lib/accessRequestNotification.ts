import "server-only";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const NOTIFICATION_FROM = "LifeSwitch <no-reply@mail.lifeswitch.com>";
const ADMIN_URL = "https://lifeswitch.com/admin";
const REQUEST_TIMEOUT_MS = 4_000;

export type AccessRequestNotificationInput = {
  accessRequestId: string;
  requestCount: number;
  email: string;
  fullName: string | null;
  message: string | null;
};

export type AccessRequestNotificationResult =
  | { status: "sent"; providerId: string }
  | { status: "not_configured" }
  | { status: "failed" };

function notificationConfig(): { apiKey: string; to: string } | null {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const to = String(process.env.ACCESS_REQUEST_NOTIFY_EMAIL || "")
    .trim()
    .toLowerCase();
  if (
    !apiKey.startsWith("re_") ||
    apiKey.length > 512 ||
    to.length < 3 ||
    to.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)
  ) {
    return null;
  }
  return { apiKey, to };
}

function notificationText(input: AccessRequestNotificationInput): string {
  return [
    "A new LifeSwitch access request is waiting for review.",
    "",
    `Name: ${input.fullName || "Not provided"}`,
    `Email: ${input.email}`,
    `Request count: ${input.requestCount}`,
    "",
    "Message:",
    input.message || "Not provided",
    "",
    `Review request: ${ADMIN_URL}`,
  ].join("\n");
}

export async function sendAccessRequestNotification(
  input: AccessRequestNotificationInput,
): Promise<AccessRequestNotificationResult> {
  const config = notificationConfig();
  if (!config) return { status: "not_configured" };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": `access-request-${input.accessRequestId}-${input.requestCount}`,
      },
      body: JSON.stringify({
        from: NOTIFICATION_FROM,
        to: [config.to],
        subject: "New LifeSwitch access request",
        text: notificationText(input),
        tags: [{ name: "category", value: "access_request" }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return { status: "failed" };

    const raw = await response.text();
    if (!raw || raw.length > 16_384) return { status: "failed" };
    const payload = JSON.parse(raw);
    const providerId =
      payload && typeof payload.id === "string" ? payload.id.trim() : "";
    if (!providerId || providerId.length > 256) return { status: "failed" };
    return { status: "sent", providerId };
  } catch {
    return { status: "failed" };
  }
}
