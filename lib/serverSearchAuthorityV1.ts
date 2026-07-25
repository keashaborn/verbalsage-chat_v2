export const SERVER_SEARCH_AUTHORITY_VERSION =
  "server_search_authority_v1" as const;

export type LegacyBrowserSearchModeV1 = "off" | "auto";
export type ServerSearchModeV1 = "auto" | "manual_override";
export type ServerSearchOverrideV1 = "off";

export type ServerSearchControlV1 = Readonly<{
  effective_mode: ServerSearchModeV1;
  requested_override: ServerSearchOverrideV1 | null;
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

  const requestedOverride = value.search_override;
  if (requestedOverride !== undefined && requestedOverride !== "off") {
    return null;
  }

  return {
    effective_mode:
      requestedOverride === "off" ? "manual_override" : "auto",
    requested_override: requestedOverride === "off" ? "off" : null,
    ignored_legacy_request_fields:
      legacyMode === undefined ? [] : ["search_mode"],
  };
}
