export const VOICE_PRIVACY_NOTICE_VERSION = "2026-07-23.v1";
export const VOICE_PRIVACY_NOTICE_STORAGE_KEY =
  "vs_voice_privacy_notice_version";

export function hasAcceptedVoicePrivacyNotice(): boolean {
  try {
    const raw = localStorage.getItem(VOICE_PRIVACY_NOTICE_STORAGE_KEY);
    if (raw == null) return false;
    try {
      return JSON.parse(raw) === VOICE_PRIVACY_NOTICE_VERSION;
    } catch {
      return raw === VOICE_PRIVACY_NOTICE_VERSION;
    }
  } catch {
    return false;
  }
}

export function storeVoicePrivacyNoticeAcceptance(): void {
  localStorage.setItem(
    VOICE_PRIVACY_NOTICE_STORAGE_KEY,
    JSON.stringify(VOICE_PRIVACY_NOTICE_VERSION),
  );
}
