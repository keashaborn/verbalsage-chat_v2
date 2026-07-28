export const VOICE_LANGUAGE_HEADER = "x-vs-voice-language";
export const DEFAULT_VOICE_LANGUAGE = "en";

export const VOICE_LANGUAGE_IDS = [
  "auto",
  "af",
  "ar",
  "hy",
  "az",
  "be",
  "bs",
  "bg",
  "ca",
  "zh",
  "hr",
  "cs",
  "da",
  "nl",
  "en",
  "et",
  "fi",
  "fr",
  "gl",
  "de",
  "el",
  "he",
  "hi",
  "hu",
  "is",
  "id",
  "it",
  "ja",
  "kn",
  "kk",
  "ko",
  "lv",
  "lt",
  "mk",
  "ms",
  "mr",
  "mi",
  "ne",
  "no",
  "fa",
  "pl",
  "pt",
  "ro",
  "ru",
  "sr",
  "sk",
  "sl",
  "es",
  "sw",
  "sv",
  "tl",
  "ta",
  "th",
  "tr",
  "uk",
  "ur",
  "vi",
  "cy",
] as const;

export type VoiceLanguage = (typeof VOICE_LANGUAGE_IDS)[number];

export type VoiceLanguageOption = {
  id: VoiceLanguage;
  label: string;
};

export function normalizeVoiceLanguage(value: unknown): VoiceLanguage {
  const normalized = String(value || "")
    .trim()
    .toLowerCase() as VoiceLanguage;
  return VOICE_LANGUAGE_IDS.includes(normalized)
    ? normalized
    : DEFAULT_VOICE_LANGUAGE;
}

export function readVoiceLanguage(): VoiceLanguage {
  try {
    const raw = localStorage.getItem("vs_voice_language");
    return normalizeVoiceLanguage(raw == null ? null : JSON.parse(raw));
  } catch {
    return DEFAULT_VOICE_LANGUAGE;
  }
}

export function storeVoiceLanguage(value: unknown): VoiceLanguage {
  const language = normalizeVoiceLanguage(value);
  try {
    localStorage.setItem("vs_voice_language", JSON.stringify(language));
  } catch {}
  return language;
}
