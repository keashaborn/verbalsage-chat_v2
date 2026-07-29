/**
 * Defense-in-depth mirror of the server-owned trusted-source registry.
 *
 * The seebx backend remains the routing and source-selection authority. These
 * unions only let the Verbal Sage BFF fail closed when validating returned
 * source URLs.
 */
export const TRUSTED_SOURCE_REGISTRY_VERSION =
  "trusted_source_registry_v1";

export const GENERAL_CURRENT_NEWS_SOURCE_DOMAINS = [
  "apnews.com",
  "reuters.com",
  "nhk.or.jp",
] as const;

export const AI_TECH_CURRENT_NEWS_SOURCE_DOMAINS = [
  "openai.com",
  "huggingface.co",
  "apnews.com",
  "reuters.com",
  "arstechnica.com",
  "wired.com",
  "theverge.com",
  "developers.openai.com",
  "supabase.com",
  "nextjs.org",
  "react.dev",
  "postgresql.org",
  "qdrant.tech",
  "docs.github.com",
  "developer.mozilla.org",
  "owasp.org",
  "nist.gov",
  "cisa.gov",
  "ietf.org",
  "w3.org",
] as const;

export const MEDICAL_HEALTH_SOURCE_DOMAINS = [
  "pubmed.ncbi.nlm.nih.gov",
  "pmc.ncbi.nlm.nih.gov",
  "clinicaltrials.gov",
  "fda.gov",
  "cdc.gov",
  "nih.gov",
  "who.int",
  "cochranelibrary.com",
  "medlineplus.gov",
  "ods.od.nih.gov",
] as const;

export const NUTRITION_FOOD_SOURCE_DOMAINS = [
  "fdc.nal.usda.gov",
  "usda.gov",
  "dietaryguidelines.gov",
  "ods.od.nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
  "pmc.ncbi.nlm.nih.gov",
  "odphp.health.gov",
  "fda.gov",
  "realfood.gov",
] as const;

export const EXERCISE_TRAINING_SOURCE_DOMAINS = [
  "pubmed.ncbi.nlm.nih.gov",
  "pmc.ncbi.nlm.nih.gov",
  "acsm.org",
  "nsca.com",
  "odphp.health.gov",
] as const;

export const BEHAVIOR_CHANGE_SOURCE_DOMAINS = [
  "pubmed.ncbi.nlm.nih.gov",
  "pmc.ncbi.nlm.nih.gov",
  "bacb.com",
] as const;

export const SOFTWARE_SECURITY_REFERENCE_SOURCE_DOMAINS = [
  "developers.openai.com",
  "supabase.com",
  "nextjs.org",
  "react.dev",
  "postgresql.org",
  "qdrant.tech",
  "docs.github.com",
  "developer.mozilla.org",
  "owasp.org",
  "nist.gov",
  "cisa.gov",
  "ietf.org",
  "w3.org",
] as const;

function uniqueDomains(
  ...packs: ReadonlyArray<readonly string[]>
): readonly string[] {
  return [...new Set(packs.flat())];
}

export const CURRENT_NEWS_ALLOWED_SOURCE_DOMAINS = uniqueDomains(
  GENERAL_CURRENT_NEWS_SOURCE_DOMAINS,
  AI_TECH_CURRENT_NEWS_SOURCE_DOMAINS,
);

export const TRUSTED_EVIDENCE_ALLOWED_SOURCE_DOMAINS = uniqueDomains(
  MEDICAL_HEALTH_SOURCE_DOMAINS,
  NUTRITION_FOOD_SOURCE_DOMAINS,
  EXERCISE_TRAINING_SOURCE_DOMAINS,
  BEHAVIOR_CHANGE_SOURCE_DOMAINS,
  SOFTWARE_SECURITY_REFERENCE_SOURCE_DOMAINS,
);
