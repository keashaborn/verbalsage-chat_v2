const MICROPHONE_PERMISSION_MESSAGE =
  "Microphone access is blocked. Allow microphone access in your browser’s website settings, then try again.";

export function voiceErrorMessage(
  error: unknown,
  fallback = "Voice is temporarily unavailable. Please try again.",
): string {
  const value = error as { name?: unknown; message?: unknown } | null;
  const name = String(value?.name || "");
  const raw = String(value?.message || error || "").trim();
  const normalized = `${name} ${raw}`.toLowerCase();

  if (
    name === "NotAllowedError" ||
    normalized.includes("user denied permission") ||
    normalized.includes("permission denied") ||
    normalized.includes("denied permission") ||
    normalized.includes("request is not allowed by the user agent") ||
    normalized.includes("not allowed by the user agent or the platform")
  ) {
    return MICROPHONE_PERMISSION_MESSAGE;
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone was found. Connect or enable a microphone, then try again.";
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The microphone could not be opened. Close other apps using it, then try again.";
  }

  if (name === "SecurityError") {
    return "Microphone access is unavailable in this browser context.";
  }

  return raw || fallback;
}
