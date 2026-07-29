import {
  automaticSearchRouteUsesExternalWebV1,
  decideSearchV1,
  SEARCH_DECISION_POLICY_VERSION,
  selectAutomaticSearchRouteV1,
  type AutomaticSearchRouteV1,
  type SearchDecisionClassV1,
  type SearchDecisionReasonV1,
  type SearchPolicyPackV1,
  // @ts-expect-error Node's strip-types runner requires the TypeScript extension.
} from "./searchDecisionV1.ts";

export const SEARCH_ROUTING_EVAL_SCHEMA_VERSION = "search_routing_eval_v1";

type EvalThresholdsV1 = Readonly<{
  overall_min_accuracy: number;
  hard_requirements_min_accuracy: number;
  category_min_accuracy: number;
  minimum_cases_per_category: number;
}>;

type SearchRoutingExpectedV1 = Readonly<{
  decision: SearchDecisionClassV1;
  policy_pack: SearchPolicyPackV1;
  route: AutomaticSearchRouteV1;
  required_reason: SearchDecisionReasonV1;
}>;

export type SearchRoutingEvalCaseV1 = Readonly<{
  id: string;
  category: string;
  prompt: string;
  hard_requirement: boolean;
  expected: SearchRoutingExpectedV1;
}>;

export type SearchRoutingEvalCorpusV1 = Readonly<{
  schema_version: typeof SEARCH_ROUTING_EVAL_SCHEMA_VERSION;
  policy_version: typeof SEARCH_DECISION_POLICY_VERSION;
  data_classification: "synthetic_no_user_data";
  thresholds: EvalThresholdsV1;
  required_categories: readonly string[];
  cases: readonly SearchRoutingEvalCaseV1[];
}>;

type SearchRoutingFailureV1 = Readonly<{
  id: string;
  category: string;
  hard_requirement: boolean;
  mismatched_fields: readonly string[];
}>;

type CategoryResultV1 = Readonly<{
  total: number;
  passed: number;
  accuracy: number;
  threshold: number;
  gate_passed: boolean;
}>;

export type SearchRoutingEvalReportV1 = Readonly<{
  schema_version: typeof SEARCH_ROUTING_EVAL_SCHEMA_VERSION;
  policy_version: typeof SEARCH_DECISION_POLICY_VERSION;
  data_classification: "synthetic_no_user_data";
  case_count: number;
  passed_case_count: number;
  overall_accuracy: number;
  hard_requirement_count: number;
  hard_requirement_accuracy: number;
  structural_violation_ids: readonly string[];
  categories: Readonly<Record<string, CategoryResultV1>>;
  failures: readonly SearchRoutingFailureV1[];
  gates: Readonly<{
    overall_accuracy: boolean;
    hard_requirements: boolean;
    category_accuracy: boolean;
    structural_integrity: boolean;
  }>;
  passed: boolean;
}>;

const DECISIONS = new Set<SearchDecisionClassV1>([
  "no_search",
  "indexed",
  "live",
  "research",
]);
const POLICY_PACKS = new Set<SearchPolicyPackV1>([
  "none",
  "general",
  "current_news",
  "health",
  "nutrition",
  "exercise",
  "software_security",
  "legal_financial",
]);
const ROUTES = new Set<AutomaticSearchRouteV1>([
  "normal_chat",
  "trusted_health",
  "current_news",
]);
const REASONS = new Set<SearchDecisionReasonV1>([
  "search_prohibited_by_user",
  "specific_source_requested",
  "explicit_research",
  "explicit_web_request",
  "trusted_current_news_scope",
  "general_current_news_scope",
  "freshness_required",
  "evidence_requested",
  "high_stakes_verification",
  "internal_context_sufficient",
  "user_content_transform",
  "stable_knowledge_default",
]);

const EXPECTED_BUDGETS: Readonly<
  Record<
    SearchDecisionClassV1,
    Readonly<{ max_searches: number; max_sources: number }>
  >
> = {
  no_search: { max_searches: 0, max_sources: 0 },
  indexed: { max_searches: 2, max_sources: 5 },
  live: { max_searches: 4, max_sources: 10 },
  research: { max_searches: 12, max_sources: 30 },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteUnitInterval(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function corpusError(message: string): never {
  throw new Error(`search routing eval corpus invalid: ${message}`);
}

export function parseSearchRoutingEvalCorpusV1(
  value: unknown,
): SearchRoutingEvalCorpusV1 {
  if (!isRecord(value)) corpusError("root");
  if (value.schema_version !== SEARCH_ROUTING_EVAL_SCHEMA_VERSION) {
    corpusError("schema_version");
  }
  if (value.policy_version !== SEARCH_DECISION_POLICY_VERSION) {
    corpusError("policy_version");
  }
  if (value.data_classification !== "synthetic_no_user_data") {
    corpusError("data_classification");
  }
  if (!isRecord(value.thresholds)) corpusError("thresholds");
  const thresholds = value.thresholds;
  if (!finiteUnitInterval(thresholds.overall_min_accuracy)) {
    corpusError("thresholds.overall_min_accuracy");
  }
  if (!finiteUnitInterval(thresholds.hard_requirements_min_accuracy)) {
    corpusError("thresholds.hard_requirements_min_accuracy");
  }
  if (!finiteUnitInterval(thresholds.category_min_accuracy)) {
    corpusError("thresholds.category_min_accuracy");
  }
  if (
    !Number.isInteger(thresholds.minimum_cases_per_category) ||
    Number(thresholds.minimum_cases_per_category) < 1
  ) {
    corpusError("thresholds.minimum_cases_per_category");
  }
  if (
    !Array.isArray(value.required_categories) ||
    value.required_categories.length === 0 ||
    value.required_categories.some(
      (category) => typeof category !== "string" || !category,
    )
  ) {
    corpusError("required_categories");
  }
  const requiredCategories = value.required_categories as string[];
  if (new Set(requiredCategories).size !== requiredCategories.length) {
    corpusError("required_categories_duplicate");
  }
  if (!Array.isArray(value.cases) || value.cases.length === 0) {
    corpusError("cases");
  }

  const ids = new Set<string>();
  const cases: SearchRoutingEvalCaseV1[] = [];
  for (const [index, rawCase] of value.cases.entries()) {
    const label = `case_${index + 1}`;
    if (!isRecord(rawCase)) corpusError(label);
    if (
      typeof rawCase.id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawCase.id)
    ) {
      corpusError(`${label}.id`);
    }
    if (ids.has(rawCase.id)) corpusError(`${rawCase.id}.duplicate`);
    ids.add(rawCase.id);
    if (
      typeof rawCase.category !== "string" ||
      !requiredCategories.includes(rawCase.category)
    ) {
      corpusError(`${rawCase.id}.category`);
    }
    if (typeof rawCase.prompt !== "string" || !rawCase.prompt.trim()) {
      corpusError(`${rawCase.id}.prompt`);
    }
    if (typeof rawCase.hard_requirement !== "boolean") {
      corpusError(`${rawCase.id}.hard_requirement`);
    }
    if (!isRecord(rawCase.expected)) {
      corpusError(`${rawCase.id}.expected`);
    }
    const expected = rawCase.expected;
    if (!DECISIONS.has(expected.decision as SearchDecisionClassV1)) {
      corpusError(`${rawCase.id}.expected.decision`);
    }
    if (!POLICY_PACKS.has(expected.policy_pack as SearchPolicyPackV1)) {
      corpusError(`${rawCase.id}.expected.policy_pack`);
    }
    if (!ROUTES.has(expected.route as AutomaticSearchRouteV1)) {
      corpusError(`${rawCase.id}.expected.route`);
    }
    if (!REASONS.has(expected.required_reason as SearchDecisionReasonV1)) {
      corpusError(`${rawCase.id}.expected.required_reason`);
    }
    if (
      (rawCase.category === "explicit_no_search" ||
        rawCase.category.endsWith("_fail_closed")) &&
      (!rawCase.hard_requirement || expected.route !== "normal_chat")
    ) {
      corpusError(`${rawCase.id}.hard_fail_closed_contract`);
    }
    cases.push({
      id: rawCase.id,
      category: rawCase.category,
      prompt: rawCase.prompt,
      hard_requirement: rawCase.hard_requirement,
      expected: {
        decision: expected.decision as SearchDecisionClassV1,
        policy_pack: expected.policy_pack as SearchPolicyPackV1,
        route: expected.route as AutomaticSearchRouteV1,
        required_reason: expected.required_reason as SearchDecisionReasonV1,
      },
    });
  }

  for (const category of requiredCategories) {
    const count = cases.filter((item) => item.category === category).length;
    if (count < Number(thresholds.minimum_cases_per_category)) {
      corpusError(`${category}.minimum_cases`);
    }
  }

  return {
    schema_version: SEARCH_ROUTING_EVAL_SCHEMA_VERSION,
    policy_version: SEARCH_DECISION_POLICY_VERSION,
    data_classification: "synthetic_no_user_data",
    thresholds: {
      overall_min_accuracy: thresholds.overall_min_accuracy as number,
      hard_requirements_min_accuracy:
        thresholds.hard_requirements_min_accuracy as number,
      category_min_accuracy: thresholds.category_min_accuracy as number,
      minimum_cases_per_category: Number(thresholds.minimum_cases_per_category),
    },
    required_categories: requiredCategories,
    cases,
  };
}

function ratio(passed: number, total: number): number {
  return total === 0 ? 0 : passed / total;
}

function structuralViolationsForCase(
  item: SearchRoutingEvalCaseV1,
): readonly string[] {
  const decision = decideSearchV1(item.prompt);
  const route = selectAutomaticSearchRouteV1(decision);
  const expectedBudget = EXPECTED_BUDGETS[decision.decision];
  const violations: string[] = [];

  if (
    decision.budget.max_searches !== expectedBudget.max_searches ||
    decision.budget.max_sources !== expectedBudget.max_sources
  ) {
    violations.push("budget");
  }
  if (
    decision.decision === "no_search" &&
    (route !== "normal_chat" ||
      decision.external_web_access ||
      decision.budget.max_searches !== 0 ||
      decision.budget.max_sources !== 0)
  ) {
    violations.push("no_search_egress");
  }
  if (
    route === "current_news" &&
    (decision.decision !== "live" ||
      (!decision.reason_codes.includes("freshness_required") &&
        !(
          decision.reason_codes.includes("explicit_web_request") &&
          decision.reason_codes.includes("trusted_current_news_scope")
        )) ||
      !["current_news", "software_security"].includes(decision.policy_pack))
  ) {
    violations.push("current_news_scope");
  }
  if (
    route === "trusted_health" &&
    (![
      "health",
      "nutrition",
      "exercise",
      "software_security",
    ].includes(decision.policy_pack) ||
      decision.decision === "no_search" ||
      decision.decision === "research")
  ) {
    violations.push("trusted_health_scope");
  }
  if (route === "normal_chat" && automaticSearchRouteUsesExternalWebV1(route)) {
    violations.push("normal_chat_egress");
  }
  return violations;
}

export function evaluateSearchRoutingV1(
  corpus: SearchRoutingEvalCorpusV1,
): SearchRoutingEvalReportV1 {
  const failures: SearchRoutingFailureV1[] = [];
  const structuralViolationIds = new Set<string>();
  const categoryCounts = new Map<string, { total: number; passed: number }>();
  let passedCaseCount = 0;
  let hardRequirementCount = 0;
  let hardRequirementPassed = 0;

  for (const item of corpus.cases) {
    const decision = decideSearchV1(item.prompt);
    const route = selectAutomaticSearchRouteV1(decision);
    const mismatchedFields: string[] = [];
    if (decision.decision !== item.expected.decision) {
      mismatchedFields.push("decision");
    }
    if (decision.policy_pack !== item.expected.policy_pack) {
      mismatchedFields.push("policy_pack");
    }
    if (route !== item.expected.route) mismatchedFields.push("route");
    if (!decision.reason_codes.includes(item.expected.required_reason)) {
      mismatchedFields.push("required_reason");
    }

    const passed = mismatchedFields.length === 0;
    if (passed) passedCaseCount += 1;
    if (item.hard_requirement) {
      hardRequirementCount += 1;
      if (passed) hardRequirementPassed += 1;
    }
    const category = categoryCounts.get(item.category) ?? {
      total: 0,
      passed: 0,
    };
    category.total += 1;
    if (passed) category.passed += 1;
    categoryCounts.set(item.category, category);
    if (!passed) {
      failures.push({
        id: item.id,
        category: item.category,
        hard_requirement: item.hard_requirement,
        mismatched_fields: mismatchedFields,
      });
    }
    if (structuralViolationsForCase(item).length > 0) {
      structuralViolationIds.add(item.id);
    }
  }

  const categories: Record<string, CategoryResultV1> = {};
  for (const category of corpus.required_categories) {
    const result = categoryCounts.get(category) ?? { total: 0, passed: 0 };
    const accuracy = ratio(result.passed, result.total);
    categories[category] = {
      total: result.total,
      passed: result.passed,
      accuracy,
      threshold: corpus.thresholds.category_min_accuracy,
      gate_passed:
        result.total >= corpus.thresholds.minimum_cases_per_category &&
        accuracy >= corpus.thresholds.category_min_accuracy,
    };
  }

  const overallAccuracy = ratio(passedCaseCount, corpus.cases.length);
  const hardRequirementAccuracy = ratio(
    hardRequirementPassed,
    hardRequirementCount,
  );
  const gates = {
    overall_accuracy: overallAccuracy >= corpus.thresholds.overall_min_accuracy,
    hard_requirements:
      hardRequirementCount > 0 &&
      hardRequirementAccuracy >=
        corpus.thresholds.hard_requirements_min_accuracy,
    category_accuracy: Object.values(categories).every(
      (category) => category.gate_passed,
    ),
    structural_integrity: structuralViolationIds.size === 0,
  };

  return {
    schema_version: SEARCH_ROUTING_EVAL_SCHEMA_VERSION,
    policy_version: SEARCH_DECISION_POLICY_VERSION,
    data_classification: "synthetic_no_user_data",
    case_count: corpus.cases.length,
    passed_case_count: passedCaseCount,
    overall_accuracy: overallAccuracy,
    hard_requirement_count: hardRequirementCount,
    hard_requirement_accuracy: hardRequirementAccuracy,
    structural_violation_ids: [...structuralViolationIds].sort(),
    categories,
    failures,
    gates,
    passed: Object.values(gates).every(Boolean),
  };
}
