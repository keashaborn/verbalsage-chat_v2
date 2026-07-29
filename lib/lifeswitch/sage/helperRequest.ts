export const SAGE_HELPER_MAX_BODY_BYTES = 16_384;
export const SAGE_HELPER_MAX_QUESTION_BYTES = 8_192;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_FIELDS = new Set(["route", "question", "target_user_id"]);

export type SageHelperRequest = Readonly<{
  route: string;
  question: string;
  targetUserId: string | null;
}>;

export type SageHelperRequestResult =
  | Readonly<{ ok: true; value: SageHelperRequest }>
  | Readonly<{
      ok: false;
      status: 400 | 413 | 422;
      code:
        | "invalid_json"
        | "invalid_request"
        | "invalid_route"
        | "invalid_question"
        | "invalid_target_user_id"
        | "request_too_large"
        | "unsupported_field";
    }>;

export function parseSageHelperRequest(raw: string): SageHelperRequestResult {
  if (new TextEncoder().encode(raw).byteLength > SAGE_HELPER_MAX_BODY_BYTES) {
    return { ok: false, status: 413, code: "request_too_large" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, code: "invalid_json" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, status: 400, code: "invalid_request" };
  }

  const source = parsed as Record<string, unknown>;
  if (Object.keys(source).some((field) => !ALLOWED_FIELDS.has(field))) {
    return { ok: false, status: 400, code: "unsupported_field" };
  }

  const route = typeof source.route === "string" ? source.route.trim() : "";
  if (!/^\/lifeswitch\/[a-z0-9/_-]+$/.test(route) || route.length > 240) {
    return { ok: false, status: 422, code: "invalid_route" };
  }

  const question =
    typeof source.question === "string" ? source.question.trim() : "";
  const questionBytes = new TextEncoder().encode(question).byteLength;
  if (
    !question ||
    question.length > 4_000 ||
    questionBytes > SAGE_HELPER_MAX_QUESTION_BYTES
  ) {
    return { ok: false, status: 422, code: "invalid_question" };
  }

  const rawTarget = source.target_user_id;
  if (
    rawTarget !== undefined &&
    rawTarget !== null &&
    (typeof rawTarget !== "string" || !UUID_RE.test(rawTarget.trim()))
  ) {
    return { ok: false, status: 422, code: "invalid_target_user_id" };
  }

  return {
    ok: true,
    value: {
      route,
      question,
      targetUserId:
        typeof rawTarget === "string" ? rawTarget.trim().toLowerCase() : null,
    },
  };
}
