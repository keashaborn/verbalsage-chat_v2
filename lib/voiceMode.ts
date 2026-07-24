export const VOICE_MODE_STORAGE_KEY = "vs_voice_mode";
export const VOICE_MODE_CHANGED_EVENT = "vs_voice_mode_changed";

export type VoiceMode = "governed" | "realtime_preview";

export const DEFAULT_VOICE_MODE: VoiceMode = "governed";

export function normalizeVoiceMode(value: unknown): VoiceMode {
  return value === "realtime_preview" ? "realtime_preview" : DEFAULT_VOICE_MODE;
}

export function voiceModeFromUserMetadata(metadata: unknown): VoiceMode | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>).vs_voice_mode;
  return value === "governed" || value === "realtime_preview" ? value : null;
}

export function cacheVoiceMode(mode: VoiceMode) {
  try {
    localStorage.setItem(VOICE_MODE_STORAGE_KEY, mode);
    window.dispatchEvent(new Event(VOICE_MODE_CHANGED_EVENT));
  } catch {}
}

export const VOICE_MODE_OPTIONS: ReadonlyArray<{
  value: VoiceMode;
  label: string;
  description: string;
  enabled: boolean;
}> = [
  {
    value: "governed",
    label: "Governed voice — Recommended",
    description:
      "Visible transcript, safeguarded response generation, and full playback controls.",
    enabled: true,
  },
  {
    value: "realtime_preview",
    label: "Realtime conversation — Preview",
    description:
      "Interruptible fullscreen conversation with governed answers and hidden live transcripts.",
    enabled: true,
  },
];
