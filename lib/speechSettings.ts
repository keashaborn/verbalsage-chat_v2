export const SPEECH_MODEL = "gpt-4o-mini-tts";
export const SPEECH_SPEED = 1;
export const SPEECH_VOICES = ["marin", "cedar"] as const;

export type SpeechVoice = (typeof SPEECH_VOICES)[number];

export function normalizeSpeechVoice(value: unknown): SpeechVoice {
  return value === "cedar" ? "cedar" : "marin";
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
