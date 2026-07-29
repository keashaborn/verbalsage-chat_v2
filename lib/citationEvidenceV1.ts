export const CITATION_EVIDENCE_CONTRACT = "citation_evidence_v1" as const;

const SOURCE_FRESHNESS_STATUSES = new Set([
  "verified_date",
  "current_reference",
  "historical",
  "unverified",
]);

const AGGREGATE_FRESHNESS_STATUSES = new Set([
  "verified",
  "mixed",
  "historical",
  "unverified",
  "not_applicable",
]);

export function isCitationSourceFreshnessStatus(
  value: unknown,
): value is string {
  return (
    typeof value === "string" && SOURCE_FRESHNESS_STATUSES.has(value)
  );
}

export function isCitationAggregateFreshnessStatus(
  value: unknown,
): value is string {
  return (
    typeof value === "string" && AGGREGATE_FRESHNESS_STATUSES.has(value)
  );
}
