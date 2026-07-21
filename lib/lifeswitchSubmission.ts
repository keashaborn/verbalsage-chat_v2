type PendingSubmission = {
  fingerprint: string;
  key: string;
  createdAt: string;
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fingerprintIntent(intent: unknown) {
  const encoded = new TextEncoder().encode(JSON.stringify(intent));
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}

export async function getOrCreateSubmission(
  storageKey: string,
  intent: unknown,
): Promise<PendingSubmission> {
  const fingerprint = await fingerprintIntent(intent);

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      const prior = JSON.parse(raw) as Partial<PendingSubmission>;
      if (
        prior.fingerprint === fingerprint &&
        typeof prior.key === "string" &&
        prior.key &&
        typeof prior.createdAt === "string" &&
        prior.createdAt
      ) {
        return prior as PendingSubmission;
      }
    }
  } catch {
    // Continue with a new token if storage is unavailable or malformed.
  }

  const pending: PendingSubmission = {
    fingerprint,
    key: window.crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(pending));
  } catch {
    // The request can still proceed; only retry persistence is unavailable.
  }

  return pending;
}

export function clearPendingSubmission(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore unavailable storage.
  }
}
