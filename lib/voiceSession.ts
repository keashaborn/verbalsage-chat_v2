export const VOICE_SESSION_HEADER = "x-vs-voice-session-id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function voiceSessionIdFromRequest(req: Request): {
  supplied: boolean;
  value: string | null;
} {
  const raw = req.headers.get(VOICE_SESSION_HEADER);
  if (raw == null) return { supplied: false, value: null };
  const value = raw.trim();
  return {
    supplied: true,
    value: UUID_RE.test(value) ? value.toLowerCase() : null,
  };
}

export function voiceSessionHeaders(
  voiceSessionId: string | null | undefined,
): Record<string, string> {
  return voiceSessionId
    ? { [VOICE_SESSION_HEADER]: voiceSessionId }
    : {};
}
