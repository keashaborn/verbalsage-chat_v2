export const SEARCH_PLAN_CONTRACT_VERSION = "search_plan_v1";
export const SEARCH_DECISION_POLICY_VERSION = "search_decision_v1_3";

export type SearchDecisionPolicyVersionV1 =
  `search_decision_v1_${number}`;

export type SearchDecisionClassV1 =
  | "no_search"
  | "indexed"
  | "live"
  | "research";

export type SearchPolicyPackV1 =
  | "none"
  | "general"
  | "current_news"
  | "health"
  | "software_security"
  | "legal_financial";

export type SearchDecisionReasonV1 =
  | "search_prohibited_by_user"
  | "specific_source_requested"
  | "explicit_research"
  | "explicit_web_request"
  | "trusted_current_news_scope"
  | "general_current_news_scope"
  | "freshness_required"
  | "evidence_requested"
  | "high_stakes_verification"
  | "internal_context_sufficient"
  | "user_content_transform"
  | "stable_knowledge_default";

export type SearchDecisionV1 = Readonly<{
  contract_version: typeof SEARCH_PLAN_CONTRACT_VERSION;
  policy_version: SearchDecisionPolicyVersionV1;
  decision: SearchDecisionClassV1;
  reason_codes: readonly SearchDecisionReasonV1[];
  policy_pack: SearchPolicyPackV1;
  query_context: "current_message_only";
  external_web_access: boolean;
  confidence: "high" | "medium";
  budget: Readonly<{
    max_searches: number;
    max_sources: number;
  }>;
}>;

const SEARCH_DECISION_POLICY_VERSION_PATTERN =
  /^search_decision_v1_[1-9][0-9]*$/;
const SEARCH_DECISION_CLASSES = new Set<SearchDecisionClassV1>([
  "no_search",
  "indexed",
  "live",
  "research",
]);
const SEARCH_POLICY_PACKS = new Set<SearchPolicyPackV1>([
  "none",
  "general",
  "current_news",
  "health",
  "software_security",
  "legal_financial",
]);
const SEARCH_REASON_CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const SEARCH_PLAN_MAX_REASON_CODES = 16;
const SEARCH_PLAN_MAX_SEARCHES = 100;
const SEARCH_PLAN_MAX_SOURCES = 250;

function boundedPlanInteger(
  value: unknown,
  maximum: number,
): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= 0 &&
    Number(value) <= maximum
  );
}

export function parseServerSearchPlanV1(
  value: unknown,
): SearchDecisionV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const plan = value as Record<string, unknown>;
  const contractVersion = String(plan.contract_version || "");
  const policyVersion = String(plan.policy_version || "");
  const decision = String(plan.decision || "");
  const policyPack = String(plan.policy_pack || "");
  const reasonCodes = Array.isArray(plan.reason_codes)
    ? plan.reason_codes.map((item) => String(item))
    : null;
  const budget =
    plan.budget && typeof plan.budget === "object" && !Array.isArray(plan.budget)
      ? (plan.budget as Record<string, unknown>)
      : null;

  if (
    contractVersion !== SEARCH_PLAN_CONTRACT_VERSION ||
    !SEARCH_DECISION_POLICY_VERSION_PATTERN.test(policyVersion) ||
    !SEARCH_DECISION_CLASSES.has(decision as SearchDecisionClassV1) ||
    !SEARCH_POLICY_PACKS.has(policyPack as SearchPolicyPackV1) ||
    plan.query_context !== "current_message_only" ||
    typeof plan.external_web_access !== "boolean" ||
    (plan.confidence !== "high" && plan.confidence !== "medium") ||
    !reasonCodes ||
    reasonCodes.length < 1 ||
    reasonCodes.length > SEARCH_PLAN_MAX_REASON_CODES ||
    new Set(reasonCodes).size !== reasonCodes.length ||
    reasonCodes.some((reason) => !SEARCH_REASON_CODE_PATTERN.test(reason)) ||
    !budget ||
    !boundedPlanInteger(
      budget.max_searches,
      SEARCH_PLAN_MAX_SEARCHES,
    ) ||
    !boundedPlanInteger(budget.max_sources, SEARCH_PLAN_MAX_SOURCES)
  ) {
    return null;
  }

  return {
    contract_version: SEARCH_PLAN_CONTRACT_VERSION,
    policy_version: policyVersion as SearchDecisionPolicyVersionV1,
    decision: decision as SearchDecisionClassV1,
    reason_codes: reasonCodes as SearchDecisionReasonV1[],
    policy_pack: policyPack as SearchPolicyPackV1,
    query_context: "current_message_only",
    external_web_access: plan.external_web_access,
    confidence: plan.confidence,
    budget: {
      max_searches: budget.max_searches,
      max_sources: budget.max_sources,
    },
  };
}

export type SearchDecisionObservedRouteV1 =
  | "normal_chat"
  | "trusted_health"
  | "current_news";

export type AutomaticSearchRouteV1 =
  | "normal_chat"
  | "trusted_health"
  | "current_news";

const NO_SEARCH_PATTERNS = [
  /\bdo not (?:search|browse|look online|use the web)\b/,
  /\bdon't (?:search|browse|look online|use the web)\b/,
  /\bnever (?:search|browse|look online|use the web)\b/,
  /\bwithout (?:searching|browsing|web search|internet access)\b/,
  /\bno (?:web|internet|online) (?:access|search(?:ing)?|browsing)\b/,
  /\bno browsing\b/,
  /\boffline only\b/,
  /\bdo not (?:access|consult|use) (?:any )?external sources?\b/,
  /\b(?:answer|respond|work) (?:only )?from (?:your )?(?:existing|internal|offline) knowledge\b/,
  /\b(?:use|rely on) (?:only )?(?:your )?(?:existing|internal|offline) knowledge\b/,
  /\bweb off\b/,
];

const SPECIFIC_SOURCE_PATTERNS = [
  /https?:\/\/\S+/,
  /\b(?:open|read|check|review|summarize)\s+(?:this|the)\s+(?:page|url|link|website)\b/,
];

const RESEARCH_PATTERNS = [
  /\bdeep research\b/,
  /\bcomprehensive literature review\b/,
  /\bsystematic review\b/,
  /\binvestigate thoroughly\b/,
  /\bexhaustive research\b/,
];

const EXPLICIT_WEB_PATTERNS = [
  /\bsearch the web\b/,
  /\bsearch online\b/,
  /\blook (?:it )?up online\b/,
  /\bbrowse the web\b/,
  /\bfind (?:online |web )?sources\b/,
  /\bcheck (?:online|the web)\b/,
];

const STRONG_FRESHNESS_PATTERNS = [
  /\bwhat just happened\b/,
  /\bjust happened\b/,
  /\bbreaking (?:news|story|update)\b/,
  /\bcurrent news\b/,
  /\bnews (?:about|on)\b/,
  /\bany (?:new|recent|current) (?:news|updates?)\b/,
  /\bwhat updates? (?:are there )?(?:about|on)\b/,
  /\bupdates? (?:about|on)\b/,
  /\bis (?:this|that) still (?:true|accurate|current)\b/,
  /\bup[- ]to[- ]date\b/,
];

const WEAK_FRESHNESS_PATTERNS = [
  /\blatest\b/,
  /\brecent\b/,
  /\bcurrent\b/,
  /\btoday\b/,
  /\byesterday\b/,
  /\bthis week\b/,
  /\bright now\b/,
];

const VOLATILE_FACT_PATTERNS = [
  /\bnews\b/,
  /\bupdates?\b/,
  /\breleases?\b/,
  /\bversions?\b/,
  /\bprices?\b/,
  /\bcosts?\b/,
  /\binterest rates?\b/,
  /\bweather\b/,
  /\bforecasts?\b/,
  /\bschedules?\b/,
  /\bscores?\b/,
  /\bstandings?\b/,
  /\blaws?\b/,
  /\bregulations?\b/,
  /\bguidelines?\b/,
  /\bguidance\b/,
  /\brecommendations?\b/,
  /\bpolic(?:y|ies)\b/,
  /\bceo\b/,
  /\bpresident\b/,
  /\bsecurity incidents?\b/,
  /\bbreaches?\b/,
  /\bcve-\d{4}-\d+\b/,
  /\boutages?\b/,
  /\bservice status\b/,
  /\bavailability\b/,
];

const EVIDENCE_PATTERNS = [
  /\bcite (?:a |your )?sources?\b/,
  /\bcite (?:studies|research|evidence|papers?)\b/,
  /\bwith citations?\b/,
  /\bprovide sources?\b/,
  /\bwhat (?:does|do) the evidence\b/,
  /\bevidence[- ]based\b/,
  /\bverify (?:this|that|the claim|whether)\b/,
  /\bfact[- ]check\b/,
  /\bis (?:this|that) true\b/,
  /\bpeer[- ]reviewed\b/,
  /\bwhat (?:does|do) the research\b/,
  /\bfind (?:a |the )?(?:study|studies|paper|papers)\b/,
];

const TRANSFORM_PATTERNS = [
  /\b(?:summarize|rewrite|edit|translate|proofread|reformat)\b[\s\S]*\b(?:the following|this text|below|above|provided|attached)\b/,
  /\b(?:the following|this text|text below|text above)\b[\s\S]*\b(?:summarize|rewrite|edit|translate|proofread|reformat)\b/,
  /\b(?:summarize|rewrite|edit|translate|proofread|reformat)\s+(?:this|the)\s+(?:text|passage|paragraph|email|message|draft|content)\b/,
];

const INTERNAL_CONTEXT_PATTERNS = [
  /\bwhat did i (?:say|tell you|ask)\b/,
  /\b(?:use|based on|according to|recall) (?:only )?what i (?:said|told|shared|wrote)\b/,
  /\bearlier in (?:this|our) (?:chat|conversation|thread)\b/,
  /\b(?:my|our) (?:previous )?(?:message|messages|conversation|thread|notes|memory|memories)\b/,
  /\b(?:my|our) (?:nutrition|workout|training|health|meal|exercise|project) (?:plan|plans|history|record|records|goals?|data)\b/,
  /\bfrom (?:my|our) (?:records|memory|conversation|thread|notes)\b/,
];

const HEALTH_TOPIC_PATTERNS = [
  /\bmedications?\b/,
  /\bdrugs?\b/,
  /\bdos(?:e|age|ing)\b/,
  /\bside effects?\b/,
  /\binteractions?\b/,
  /\bcontraindications?\b/,
  /\bsymptoms?\b/,
  /\bdiagnos(?:is|e|tic)\b/,
  /\btreatments?\b/,
  /\bclinical\b/,
  /\bcreatine\b/,
  /\bsupplements?\b/,
  /\bvitamins?\b/,
  /\bminerals?\b/,
  /\bnutrition\b/,
  /\bpregnan(?:t|cy)\b/,
  /\bkidney\b/,
  /\bliver\b/,
  /\bheart\b/,
  /\bblood pressure\b/,
];

const HEALTH_RISK_PATTERNS = [
  /\bis (?:it|this|that) safe\b/,
  /\bis [a-z0-9 ,'-]{1,80} safe\b/,
  /\bshould i (?:take|stop|start|use)\b/,
  /\bhow much should i (?:take|use)\b/,
  /\bwhat (?:dose|dosage)\b/,
  /\bside effects?\b/,
  /\binteractions?\b/,
  /\bcontraindications?\b/,
  /\bdiagnos(?:is|e)\b/,
  /\btreatments?\b/,
];

const SOFTWARE_SECURITY_PATTERNS = [
  /\bopenai\b/,
  /\bsupabase\b/,
  /\bnext\.?js\b/,
  /\breact\b/,
  /\bpostgres(?:ql)?\b/,
  /\bqdrant\b/,
  /\bapi\b/,
  /\bsoftware\b/,
  /\bsecurity\b/,
  /\bvulnerabilit(?:y|ies)\b/,
  /\bbreaches?\b/,
  /\bcve-\d{4}-\d+\b/,
];

const LEGAL_FINANCIAL_PATTERNS = [
  /\blaws?\b/,
  /\blegal\b/,
  /\bregulations?\b/,
  /\btax(?:es)?\b/,
  /\bcompliance\b/,
  /\bstocks?\b/,
  /\bsecurities\b/,
  /\binterest rates?\b/,
  /\bexchange rates?\b/,
  /\bfinancial\b/,
];

const TRUSTED_CURRENT_NEWS_ENTITY_PATTERNS = [
  /\bopenai\b/,
  /\bopen eye\b/,
  /\bchatgpt\b/,
  /\bhugging\s*face\b/,
  /\bhuggingface\b/,
];

function normalizedInput(input: string): string {
  return String(input || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function uniqueReasons(
  reasons: readonly SearchDecisionReasonV1[],
): readonly SearchDecisionReasonV1[] {
  return [...new Set(reasons)];
}

function policyPackFor(value: string): SearchPolicyPackV1 {
  if (matchesAny(value, HEALTH_TOPIC_PATTERNS)) return "health";
  if (
    matchesAny(value, SOFTWARE_SECURITY_PATTERNS) ||
    matchesAny(value, TRUSTED_CURRENT_NEWS_ENTITY_PATTERNS)
  ) {
    return "software_security";
  }
  if (matchesAny(value, LEGAL_FINANCIAL_PATTERNS)) {
    return "legal_financial";
  }
  return "general";
}

function budgetFor(decision: SearchDecisionClassV1) {
  if (decision === "research") {
    return { max_searches: 12, max_sources: 30 } as const;
  }
  if (decision === "live") {
    return { max_searches: 4, max_sources: 10 } as const;
  }
  if (decision === "indexed") {
    return { max_searches: 2, max_sources: 5 } as const;
  }
  return { max_searches: 0, max_sources: 0 } as const;
}

function decisionV1(
  decision: SearchDecisionClassV1,
  reasons: readonly SearchDecisionReasonV1[],
  policyPack: SearchPolicyPackV1,
  confidence: "high" | "medium",
): SearchDecisionV1 {
  return {
    contract_version: SEARCH_PLAN_CONTRACT_VERSION,
    policy_version: SEARCH_DECISION_POLICY_VERSION,
    decision,
    reason_codes: uniqueReasons(reasons),
    policy_pack: decision === "no_search" ? "none" : policyPack,
    query_context: "current_message_only",
    external_web_access: decision === "live" || decision === "research",
    confidence,
    budget: budgetFor(decision),
  };
}

export function isSearchExplicitlyProhibitedV1(input: string): boolean {
  const value = normalizedInput(input);
  return Boolean(value) && matchesAny(value, NO_SEARCH_PATTERNS);
}

export function decideSearchV1(input: string): SearchDecisionV1 {
  const value = normalizedInput(input);
  if (!value) {
    return decisionV1(
      "no_search",
      ["stable_knowledge_default"],
      "none",
      "high",
    );
  }

  if (isSearchExplicitlyProhibitedV1(value)) {
    return decisionV1(
      "no_search",
      ["search_prohibited_by_user"],
      "none",
      "high",
    );
  }

  const policyPack = policyPackFor(value);
  const trustedCurrentNewsScope = matchesAny(
    value,
    TRUSTED_CURRENT_NEWS_ENTITY_PATTERNS,
  );
  if (matchesAny(value, SPECIFIC_SOURCE_PATTERNS)) {
    return decisionV1(
      "live",
      ["specific_source_requested"],
      policyPack,
      "high",
    );
  }

  if (matchesAny(value, RESEARCH_PATTERNS)) {
    return decisionV1("research", ["explicit_research"], policyPack, "high");
  }

  if (matchesAny(value, TRANSFORM_PATTERNS)) {
    return decisionV1("no_search", ["user_content_transform"], "none", "high");
  }

  if (matchesAny(value, INTERNAL_CONTEXT_PATTERNS)) {
    return decisionV1(
      "no_search",
      ["internal_context_sufficient"],
      "none",
      "high",
    );
  }

  const explicitWeb = matchesAny(value, EXPLICIT_WEB_PATTERNS);
  const strongFreshness = matchesAny(value, STRONG_FRESHNESS_PATTERNS);
  const weakFreshness =
    matchesAny(value, WEAK_FRESHNESS_PATTERNS) &&
    (matchesAny(value, VOLATILE_FACT_PATTERNS) || trustedCurrentNewsScope);
  if (strongFreshness || weakFreshness) {
    return decisionV1(
      "live",
      [
        "freshness_required",
        ...(explicitWeb ? (["explicit_web_request"] as const) : []),
        ...(trustedCurrentNewsScope
          ? (["trusted_current_news_scope"] as const)
          : []),
      ],
      policyPack,
      strongFreshness ? "high" : "medium",
    );
  }

  if (explicitWeb) {
    return decisionV1(
      trustedCurrentNewsScope ? "live" : "indexed",
      [
        "explicit_web_request",
        ...(trustedCurrentNewsScope
          ? (["trusted_current_news_scope"] as const)
          : []),
      ],
      policyPack,
      "high",
    );
  }

  const evidenceRequested = matchesAny(value, EVIDENCE_PATTERNS);
  const highStakesHealth =
    matchesAny(value, HEALTH_TOPIC_PATTERNS) &&
    matchesAny(value, HEALTH_RISK_PATTERNS);
  const highStakesOther =
    matchesAny(value, LEGAL_FINANCIAL_PATTERNS) ||
    (matchesAny(value, SOFTWARE_SECURITY_PATTERNS) &&
      matchesAny(value, [
        /\bsecurity\b/,
        /\bvulnerabilit(?:y|ies)\b/,
        /\bbreaches?\b/,
        /\bcve-\d{4}-\d+\b/,
      ]));
  if (evidenceRequested || highStakesHealth || highStakesOther) {
    return decisionV1(
      "indexed",
      [
        ...(evidenceRequested ? (["evidence_requested"] as const) : []),
        ...(highStakesHealth || highStakesOther
          ? (["high_stakes_verification"] as const)
          : []),
      ],
      policyPack,
      evidenceRequested ? "high" : "medium",
    );
  }

  return decisionV1(
    "no_search",
    ["stable_knowledge_default"],
    "none",
    "medium",
  );
}

export function selectAutomaticSearchRouteV1(
  decision: SearchDecisionV1,
): AutomaticSearchRouteV1 {
  if (decision.decision === "no_search") return "normal_chat";
  if (
    decision.decision === "research" ||
    decision.reason_codes.includes("specific_source_requested")
  ) {
    return "normal_chat";
  }
  if (decision.policy_pack === "health") return "trusted_health";
  if (
    decision.reason_codes.includes("trusted_current_news_scope") &&
    (decision.reason_codes.includes("freshness_required") ||
      decision.reason_codes.includes("explicit_web_request"))
  ) {
    return "current_news";
  }
  if (
    (decision.policy_pack === "current_news" ||
      decision.policy_pack === "software_security") &&
    decision.reason_codes.includes("freshness_required")
  ) {
    return "current_news";
  }
  return "normal_chat";
}

export function automaticSearchRouteUsesExternalWebV1(
  route: AutomaticSearchRouteV1,
): boolean {
  return route !== "normal_chat";
}

function inputCharsBucket(input: string): string {
  const length = String(input || "").length;
  if (length === 0) return "0";
  if (length <= 80) return "1-80";
  if (length <= 240) return "81-240";
  if (length <= 800) return "241-800";
  if (length <= 2_000) return "801-2000";
  return "2001+";
}

export function recordSearchRoutingEnforcedV1({
  actorUserId,
  requestId,
  selectedRoute,
  input,
  decision = decideSearchV1(input),
}: {
  actorUserId: string;
  requestId: string;
  selectedRoute: AutomaticSearchRouteV1;
  input: string;
  decision?: SearchDecisionV1;
}): SearchDecisionV1 {
  if (
    process.env.SEARCH_DECISION_AUDIT_ENABLED !== "1" &&
    process.env.SEARCH_DECISION_SHADOW_ENABLED !== "1"
  ) {
    return decision;
  }

  try {
    console.info(
      JSON.stringify({
        event: "search_routing_enforced_v1",
        request_id: requestId,
        actor_user_id: actorUserId,
        authority: "server",
        selected_route: selectedRoute,
        executed_external_web_access:
          automaticSearchRouteUsesExternalWebV1(selectedRoute),
        input_chars_bucket: inputCharsBucket(input),
        ...decision,
      }),
    );
  } catch {
    // Routing observability must never affect the user response path.
  }
  return decision;
}

export function recordSearchDecisionShadowV1({
  actorUserId,
  requestId,
  observedRoute,
  input,
}: {
  actorUserId: string;
  requestId: string;
  observedRoute: SearchDecisionObservedRouteV1;
  input: string;
}): SearchDecisionV1 {
  const decision = decideSearchV1(input);
  if (process.env.SEARCH_DECISION_SHADOW_ENABLED !== "1") return decision;

  try {
    console.info(
      JSON.stringify({
        event: "search_decision_shadow_v1",
        request_id: requestId,
        actor_user_id: actorUserId,
        observed_route: observedRoute,
        input_chars_bucket: inputCharsBucket(input),
        ...decision,
      }),
    );
  } catch {
    // Shadow observability must never affect the user response path.
  }
  return decision;
}
