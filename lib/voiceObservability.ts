export const VOICE_TURN_HEADER = "x-vs-voice-turn-id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeVoiceTurnId(value: unknown): string | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  return UUID_RE.test(raw) ? raw : null;
}

export function voiceTurnIdFromRequest(req: Request): {
  supplied: boolean;
  value: string | null;
} {
  const raw = req.headers.get(VOICE_TURN_HEADER);
  return {
    supplied: raw != null && raw.trim() !== "",
    value: normalizeVoiceTurnId(raw),
  };
}

export function voiceTurnHeaders(
  voiceTurnId: string | null,
): Record<string, string> {
  return voiceTurnId ? { [VOICE_TURN_HEADER]: voiceTurnId } : {};
}
