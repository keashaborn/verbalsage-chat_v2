type SourceUrlAllowed = (raw: unknown) => boolean;

const HTTP_URL_RE = /https?:\/\/[^\s<>'"`]+/gi;
const MARKDOWN_LINK_TARGET_RE = /!?\[[^\]\r\n]*\]\(\s*<?([^\s)>]+)>?/g;
const WWW_URL_RE = /(?<![@\w])www\.[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>'"`]*)?/gi;
const EMAIL_AUTOLINK_RE =
  /(?<![\w.+-])[\w.+-]+@[a-z0-9.-]+\.[a-z]{2,}(?![\w-])/i;
const TRACKING_QUERY_KEYS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
]);

function trimTrailingUrlPunctuation(value: string): string {
  return value.trim().replace(/[.,;:!?\)\]\}]+$/g, "");
}

function canonicalWebSourceUrl(raw: unknown): string | null {
  try {
    const parsed = new URL(String(raw || "").trim());
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.port
    ) {
      return null;
    }
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      const normalized = key.toLowerCase();
      if (
        normalized.startsWith("utm_") ||
        TRACKING_QUERY_KEYS.has(normalized)
      ) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/g, "") || "/";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function answerLinksAllowed(
  answer: string,
  sourceUrlAllowed: SourceUrlAllowed,
  allowedSourceUrls?: readonly string[],
): boolean {
  if (EMAIL_AUTOLINK_RE.test(answer)) return false;
  const exactAllowedUrls =
    allowedSourceUrls === undefined
      ? null
      : new Set(
          allowedSourceUrls
            .map(canonicalWebSourceUrl)
            .filter((url): url is string => Boolean(url)),
        );

  const candidates = [
    ...[...answer.matchAll(MARKDOWN_LINK_TARGET_RE)].map((match) => match[1]),
    ...[...answer.matchAll(HTTP_URL_RE)].map((match) => match[0]),
    ...[...answer.matchAll(WWW_URL_RE)].map((match) => `https://${match[0]}`),
  ];

  for (const rawCandidate of new Set(candidates)) {
    const candidate = trimTrailingUrlPunctuation(rawCandidate);
    if (
      !candidate.toLowerCase().startsWith("https://") &&
      !candidate.toLowerCase().startsWith("http://")
    ) {
      return false;
    }
    if (!sourceUrlAllowed(candidate)) return false;
    const canonicalCandidate = canonicalWebSourceUrl(candidate);
    if (!canonicalCandidate) return false;
    if (exactAllowedUrls && !exactAllowedUrls.has(canonicalCandidate)) {
      return false;
    }
  }
  return true;
}
