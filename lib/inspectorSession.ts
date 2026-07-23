export const INSPECTOR_SESSION_MAX_AGE_SECONDS = 60 * 60 * 6;

export function inspectorSessionCookieName(
  production = process.env.NODE_ENV === "production",
): string {
  return production
    ? "__Host-vs_inspector_enabled"
    : "vs_inspector_enabled";
}

export function inspectorSessionEnabled(value: string | undefined): boolean {
  return value === "1";
}

export function inspectorSessionCookie(
  enabled: boolean,
  production = process.env.NODE_ENV === "production",
): string {
  const name = inspectorSessionCookieName(production);
  const value = enabled ? "1" : "";
  const maxAge = enabled ? INSPECTOR_SESSION_MAX_AGE_SECONDS : 0;
  const secure = production ? "; Secure" : "";
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure}`;
}

export function retiredInspectorCookieDeletion(
  production = process.env.NODE_ENV === "production",
): string {
  const secure = production ? "; Secure" : "";
  return `vs_debug_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure}`;
}

export const INSPECTOR_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
} as const;
