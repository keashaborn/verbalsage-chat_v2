export const BRAINS_TRANSCRIPTION_TIMEOUT_MS = 65_000;
export const BROWSER_TRANSCRIPTION_TIMEOUT_MS = 70_000;
export const BRAINS_RESPONSE_TIMEOUT_MS = 92_000;
export const BROWSER_RESPONSE_TIMEOUT_MS = 95_000;
export const TTS_SEGMENT_TIMEOUT_MS = 90_000;

export class RequestDeadlineError extends Error {
  constructor(message = "The request took too long.") {
    super(message);
    this.name = "RequestDeadlineError";
  }
}

export function requestDeadlineSignal(
  timeoutMs: number,
  parent?: AbortSignal | null,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!parent) return timeout;
  return AbortSignal.any([parent, timeout]);
}

export async function withRequestDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parent?: AbortSignal | null,
): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = parent ? AbortSignal.any([parent, timeout]) : timeout;
  try {
    return await operation(signal);
  } catch (error: any) {
    if (timeout.aborted && !parent?.aborted) {
      throw new RequestDeadlineError();
    }
    throw error;
  }
}

export function isAbortLike(error: unknown): boolean {
  const name = String((error as any)?.name || "");
  return name === "AbortError" || name === "TimeoutError";
}
