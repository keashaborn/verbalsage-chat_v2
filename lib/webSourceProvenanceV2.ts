export const WEB_SOURCE_PROVENANCE_CONTRACT =
  "web_source_provenance_v2" as const;

const TRACKING_QUERY_KEYS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
]);

export function canonicalWebSourceUrl(raw: unknown): string | null {
  try {
    const parsed = new URL(String(raw || "").trim());
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.port
    ) {
      return null;
    }
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      const normalized = key.toLowerCase();
      if (
        normalized.startsWith("utm_") ||
        TRACKING_QUERY_KEYS.has(normalized)
      ) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/g, "") || "/";
    return parsed.toString();
  } catch {
    return null;
  }
}
