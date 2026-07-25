type SourceUrlAllowed = (raw: unknown) => boolean;

const HTTP_URL_RE = /https?:\/\/[^\s<>'"`]+/gi;
const MARKDOWN_LINK_TARGET_RE = /!?\[[^\]\r\n]*\]\(\s*<?([^\s)>]+)>?/g;
const WWW_URL_RE = /(?<![@\w])www\.[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>'"`]*)?/gi;
const EMAIL_AUTOLINK_RE =
  /(?<![\w.+-])[\w.+-]+@[a-z0-9.-]+\.[a-z]{2,}(?![\w-])/i;

function trimTrailingUrlPunctuation(value: string): string {
  return value.trim().replace(/[.,;:!?\)\]\}]+$/g, "");
}

export function answerLinksAllowed(
  answer: string,
  sourceUrlAllowed: SourceUrlAllowed,
): boolean {
  if (EMAIL_AUTOLINK_RE.test(answer)) return false;

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
  }
  return true;
}
