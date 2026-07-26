export const ACCOUNT_IDENTITY_CHANGED_EVENT =
  "vs_account_identity_changed";

export function normalizeAccountFullName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}
