export const SPEECH_MODEL = "gpt-4o-mini-tts";
export const SPEECH_SPEED = 1;
export const SPEECH_VOICES = [
  "marin",
  "cedar",
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
] as const;

export type SpeechVoice = (typeof SPEECH_VOICES)[number];

export function normalizeSpeechVoice(value: unknown): SpeechVoice {
  const normalized = String(value || "")
    .trim()
    .toLowerCase() as SpeechVoice;
  return SPEECH_VOICES.includes(normalized) ? normalized : "marin";
}

export function readSpeechVoice(): SpeechVoice {
  try {
    const raw = localStorage.getItem("vs_voice");
    return normalizeSpeechVoice(raw == null ? null : JSON.parse(raw));
  } catch {
    return "marin";
  }
}

export function storeSpeechVoice(value: unknown): SpeechVoice {
  const voice = normalizeSpeechVoice(value);
  try {
    localStorage.setItem("vs_voice", JSON.stringify(voice));
  } catch {}
  return voice;
}
