export const SAGE_PAGE_CONTRACT_SCHEMA_VERSION = "1.0" as const;

export type SageDomain =
  | "plan"
  | "nutrition"
  | "training"
  | "measurements"
  | "people";

export type SagePlanSection =
  | "primary_goal"
  | "phase"
  | "training_targets"
  | "conditioning_targets"
  | "recovery_targets"
  | "monitoring_rules";

export type SagePageQueryParameter = Readonly<{
  name: string;
  purpose: string;
  authority: "authorization_target" | "display_hint" | "diagnostic";
}>;

export type SagePageDataSource = Readonly<{
  id: string;
  consumer: "page" | "helper";
  operation: "read" | "mutate";
  method: "GET" | "POST";
  frontendPath: string;
  upstreamPath: string;
  purpose: string;
  authorization:
    | "authenticated_owner"
    | "authenticated_owner_or_training_view"
    | "authenticated_owner_or_plan_view"
    | "authenticated_owner_self_only";
  resultBoundary: string;
  failureBehavior: string;
}>;

export type SagePageControl = Readonly<{
  id: string;
  label: string;
  kind: "display" | "disclosure" | "navigate" | "refresh" | "mutate";
  surface:
    | "page"
    | "session_action_menu"
    | "workflow_navigation"
    | "recovery_notice";
  visibleTo: "all_viewers" | "owner_only";
  usableForTargetBy: "all_viewers" | "owner_only" | "nobody";
  effect: string;
  destination?: string;
  dataSourceId?: string;
  confirmation: "none" | "browser_confirm";
  auditResult: "none" | "preserved";
}>;

export type SagePageState = Readonly<{
  id: string;
  when: string;
  userMeaning: string;
  helperGuidance: string;
  recommendedControlIds: readonly string[];
  prohibitedClaims: readonly string[];
}>;

export type SageSourceReference = Readonly<{
  system: "frontend" | "backend";
  path: string;
  symbols: readonly string[];
  proves: string;
}>;

export type SagePageContract = Readonly<{
  schemaVersion: typeof SAGE_PAGE_CONTRACT_SCHEMA_VERSION;
  contractVersion: string;
  pageId: string;
  status: "active";
  domain: SageDomain;
  route: Readonly<{
    canonicalPath: string;
    aliases: readonly string[];
    queryParameters: readonly SagePageQueryParameter[];
  }>;
  purpose: Readonly<{
    summary: string;
    userGoals: readonly string[];
    nonGoals: readonly string[];
  }>;
  access: Readonly<{
    authenticationRequired: true;
    selfView: "owner";
    delegatedView: Readonly<{
      allowed: boolean;
      permission: string;
      mode: "read_only";
    }>;
    mutations: Readonly<{
      selfOnly: true;
      backendInvariant: string;
    }>;
  }>;
  planContext: Readonly<{
    sections: readonly SagePlanSection[];
    purpose: string;
    missingBehavior: string;
    mutationPolicy: "read_only_context";
  }>;
  dataSources: readonly SagePageDataSource[];
  controls: readonly SagePageControl[];
  states: readonly SagePageState[];
  workflow: Readonly<{
    sequence: readonly string[];
    entryPoints: readonly string[];
    validNextControlIds: readonly string[];
  }>;
  interpretationRules: readonly string[];
  responsePolicy: Readonly<{
    must: readonly string[];
    mustNot: readonly string[];
  }>;
  knownRisks: readonly string[];
  evidence: Readonly<{
    verifiedAt: string;
    frontendRevision: string;
    backendRevision: string;
    sources: readonly SageSourceReference[];
  }>;
}>;

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  return [...duplicates].sort();
}

export function validateSagePageContract(
  contract: SagePageContract,
): readonly string[] {
  const errors: string[] = [];

  if (contract.schemaVersion !== SAGE_PAGE_CONTRACT_SCHEMA_VERSION) {
    errors.push(`unsupported schemaVersion: ${contract.schemaVersion}`);
  }
  if (!/^[a-z][a-z0-9]*(?:\.[a-z0-9]+)+$/.test(contract.pageId)) {
    errors.push(`invalid pageId: ${contract.pageId}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(contract.contractVersion)) {
    errors.push(`invalid contractVersion: ${contract.contractVersion}`);
  }
  if (!contract.route.canonicalPath.startsWith("/lifeswitch/")) {
    errors.push("canonicalPath must be a LifeSwitch route");
  }
  if (contract.route.aliases.includes(contract.route.canonicalPath)) {
    errors.push("canonicalPath must not also be an alias");
  }

  for (const duplicate of duplicateValues(contract.route.aliases)) {
    errors.push(`duplicate route alias: ${duplicate}`);
  }

  const dataSourceIds = contract.dataSources.map((source) => source.id);
  for (const duplicate of duplicateValues(dataSourceIds)) {
    errors.push(`duplicate data source id: ${duplicate}`);
  }

  const controlIds = contract.controls.map((control) => control.id);
  for (const duplicate of duplicateValues(controlIds)) {
    errors.push(`duplicate control id: ${duplicate}`);
  }

  const stateIds = contract.states.map((state) => state.id);
  for (const duplicate of duplicateValues(stateIds)) {
    errors.push(`duplicate state id: ${duplicate}`);
  }

  const dataSourceIdSet = new Set(dataSourceIds);
  const controlIdSet = new Set(controlIds);

  for (const control of contract.controls) {
    if (control.dataSourceId && !dataSourceIdSet.has(control.dataSourceId)) {
      errors.push(
        `control ${control.id} references unknown data source ${control.dataSourceId}`,
      );
    }
    if (control.kind === "navigate" && !control.destination) {
      errors.push(`navigation control ${control.id} requires a destination`);
    }
    if (control.kind === "mutate") {
      if (!control.dataSourceId) {
        errors.push(`mutation control ${control.id} requires a data source`);
      }
      if (control.confirmation === "none") {
        errors.push(`mutation control ${control.id} requires confirmation`);
      }
      if (control.usableForTargetBy !== "owner_only") {
        errors.push(`mutation control ${control.id} must be owner-only`);
      }
      if (control.auditResult !== "preserved") {
        errors.push(
          `mutation control ${control.id} must preserve audit history`,
        );
      }
    }
  }

  for (const state of contract.states) {
    for (const controlId of state.recommendedControlIds) {
      if (!controlIdSet.has(controlId)) {
        errors.push(
          `state ${state.id} references unknown control ${controlId}`,
        );
      }
    }
  }

  for (const controlId of contract.workflow.validNextControlIds) {
    if (!controlIdSet.has(controlId)) {
      errors.push(`workflow references unknown control ${controlId}`);
    }
  }

  if (contract.planContext.sections.length === 0) {
    errors.push("at least one Plan section is required");
  }
  if (contract.responsePolicy.must.length === 0) {
    errors.push("responsePolicy.must cannot be empty");
  }
  if (contract.responsePolicy.mustNot.length === 0) {
    errors.push("responsePolicy.mustNot cannot be empty");
  }
  if (contract.evidence.sources.length === 0) {
    errors.push("at least one source reference is required");
  }

  return errors;
}

export function assertValidSagePageContract(
  contract: SagePageContract,
): SagePageContract {
  const errors = validateSagePageContract(contract);
  if (errors.length > 0) {
    throw new Error(
      `Invalid Sage page contract ${contract.pageId}: ${errors.join("; ")}`,
    );
  }
  return contract;
}
