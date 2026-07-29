export const SERVER_SEARCH_AUTHORITY_VERSION =
  "server_search_authority_v1" as const;

export type LegacyBrowserSearchModeV1 = "off" | "auto";
export type ServerSearchModeV1 = "auto";

export type ServerSearchControlV1 = Readonly<{
  effective_mode: ServerSearchModeV1;
  requested_override: null;
  ignored_legacy_request_fields: readonly string[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resolveServerSearchControlV1(
  value: unknown,
): ServerSearchControlV1 | null {
  if (!isRecord(value)) return null;

  const legacyMode = value.search_mode;
  if (
    legacyMode !== undefined &&
    legacyMode !== "off" &&
    legacyMode !== "auto"
  ) {
    return null;
  }

  if (value.search_override !== undefined) return null;

  return {
    effective_mode: "auto",
    requested_override: null,
    ignored_legacy_request_fields:
      legacyMode === undefined ? [] : ["search_mode"],
  };
}
