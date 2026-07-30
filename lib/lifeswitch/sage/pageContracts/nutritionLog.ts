import type { SagePageContract } from "../pageContract";

export const nutritionLogContract = {
  schemaVersion: "1.0",
  contractVersion: "2026-07-30.1",
  pageId: "nutrition.log",
  status: "active",
  domain: "nutrition",
  route: {
    canonicalPath: "/lifeswitch/nutrition/log",
    aliases: [],
    queryParameters: [
      {
        name: "target_user_id",
        purpose: "Select an authorized delegated nutrition-data target.",
        authority: "authorization_target",
      },
      {
        name: "target_name",
        purpose: "Display-only label for an authorized delegated target.",
        authority: "display_hint",
      },
      {
        name: "debug",
        purpose: "Expose local page diagnostics when set to 1.",
        authority: "diagnostic",
      },
    ],
  },
  purpose: {
    summary:
      "Review recent Nutrition logs, daily macro totals, Plan-scored status, and food entries.",
    userGoals: [
      "Understand the meaning of In progress, Hit, Not hit, and No log.",
      "Review monthly logged-day and nutrition summaries.",
      "Expand a logged day to review its food and meal entries.",
      "Compare finalized Nutrition observations with authorized Plan targets.",
      "Understand the next valid Nutrition workflow step.",
    ],
    nonGoals: [
      "Treat an unlogged day as evidence that no food was consumed.",
      "Treat an in-progress day as a failed Plan day.",
      "Create foods, meals, or meal plans from the Log page.",
      "Change the unified Plan.",
      "Provide Behavior treatment or Verbal behavior analysis.",
    ],
  },
  access: {
    authenticationRequired: true,
    selfView: "owner",
    delegatedView: {
      allowed: true,
      permission: "nutrition:view",
      mode: "read_only",
    },
    mutations: {
      selfOnly: true,
      backendInvariant:
        "Delegated Nutrition reads require nutrition:view. Day completion and entry mutations remain owner-only and do not accept delegated targets.",
    },
  },
  planContext: {
    sections: [
      "primary_goal",
      "phase",
      "nutrition_targets",
      "recovery_targets",
      "monitoring_rules",
    ],
    purpose:
      "Interpret finalized Nutrition observations against the current authorized Plan without changing either source.",
    missingBehavior:
      "Explain the page and observed logs without assigning Hit or Not hit when authorized Plan targets are unavailable.",
    mutationPolicy: "read_only_context",
  },
  dataSources: [
    {
      id: "nutrition.log.range",
      consumer: "page",
      operation: "read",
      method: "GET",
      frontendPath: "/api/lifeswitch/nutrition/log/range",
      upstreamPath: "/lifeswitch/nutrition/log/range",
      purpose:
        "Return the visible 60-day Nutrition window with daily totals and entries.",
      authorization: "authenticated_owner_or_nutrition_view",
      resultBoundary:
        "A bounded date window; delegated reads require nutrition:view.",
      failureBehavior:
        "Do not interpret a failed request as an empty Nutrition history.",
    },
    {
      id: "plan.active.current",
      consumer: "page",
      operation: "read",
      method: "GET",
      frontendPath: "/api/lifeswitch/plan/agentic/active",
      upstreamPath: "/lifeswitch/plan/active",
      purpose:
        "Return the current active unified Plan used by Nutrition scoring.",
      authorization: "authenticated_owner_or_plan_view",
      resultBoundary:
        "The active Plan may be absent and delegated access independently requires plan:view.",
      failureBehavior:
        "Fall back to the legacy Plan profile only when permitted; otherwise mark Plan context unavailable.",
    },
    {
      id: "plan.profile.current",
      consumer: "helper",
      operation: "read",
      method: "GET",
      frontendPath: "/api/lifeswitch/plan/profile?create_if_missing=0",
      upstreamPath: "/lifeswitch/plan/profile",
      purpose:
        "Provide a read-only legacy Plan fallback without creating a profile.",
      authorization: "authenticated_owner_or_plan_view",
      resultBoundary:
        "No profile is created; delegated access independently requires plan:view.",
      failureBehavior:
        "Continue with Nutrition observations and state that Plan interpretation is unavailable.",
    },
    {
      id: "nutrition.recovery_adjustments.current",
      consumer: "page",
      operation: "read",
      method: "GET",
      frontendPath: "/api/lifeswitch/plan/agentic/recovery-adjustments",
      upstreamPath: "/lifeswitch/plan/recovery-adjustments",
      purpose:
        "Return active Nutrition recovery periods that exclude eligible days from adherence scoring.",
      authorization: "authenticated_owner_or_plan_view",
      resultBoundary:
        "Only authorized adjustments overlapping the current local day are needed.",
      failureBehavior:
        "Keep the log usable and state that recovery status is unavailable.",
    },
    {
      id: "nutrition.day.completion",
      consumer: "page",
      operation: "mutate",
      method: "PATCH",
      frontendPath: "/api/lifeswitch/nutrition/log/day",
      upstreamPath: "/lifeswitch/nutrition/log/day",
      purpose: "Finish or reopen the owner's current Nutrition day.",
      authorization: "authenticated_owner_self_only",
      resultBoundary: "Owner-only mutation for the requested day.",
      failureBehavior:
        "Report that the completion state did not change and retain the displayed state.",
    },
    {
      id: "nutrition.entry.update",
      consumer: "page",
      operation: "mutate",
      method: "PATCH",
      frontendPath: "/api/lifeswitch/nutrition/log/entry",
      upstreamPath: "/lifeswitch/nutrition/log/entry",
      purpose: "Update an owned food entry quantity.",
      authorization: "authenticated_owner_self_only",
      resultBoundary: "Owner-only mutation for an owned entry.",
      failureBehavior:
        "Report that the quantity was not saved and retain the prior value.",
    },
    {
      id: "nutrition.entry.delete",
      consumer: "page",
      operation: "mutate",
      method: "DELETE",
      frontendPath: "/api/lifeswitch/nutrition/log/entry",
      upstreamPath: "/lifeswitch/nutrition/log/entry",
      purpose:
        "Permanently remove an owned Nutrition entry after confirmation.",
      authorization: "authenticated_owner_self_only",
      resultBoundary: "Owner-only deletion for an owned entry.",
      failureBehavior:
        "Report that deletion failed and retain the current entry.",
    },
  ],
  controls: [
    {
      id: "nutrition.day_marker",
      label: "Logged day",
      kind: "disclosure",
      surface: "page",
      visibleTo: "all_viewers",
      usableForTargetBy: "all_viewers",
      effect:
        "A date with Nutrition data expands and scrolls to that day's summary; a No log date is display-only.",
      confirmation: "none",
      auditResult: "none",
    },
    {
      id: "nutrition.day_summary",
      label: "Day summary",
      kind: "disclosure",
      surface: "page",
      visibleTo: "all_viewers",
      usableForTargetBy: "all_viewers",
      effect: "Expand or collapse a logged day to review totals and entries.",
      confirmation: "none",
      auditResult: "none",
    },
    {
      id: "nutrition.capture",
      label: "Capture",
      kind: "navigate",
      surface: "workflow_navigation",
      visibleTo: "all_viewers",
      usableForTargetBy: "owner_only",
      effect: "Open the owner workflow for recording Nutrition entries.",
      destination: "/lifeswitch/nutrition/capture",
      confirmation: "none",
      auditResult: "none",
    },
    {
      id: "nutrition.analyze",
      label: "Analyze",
      kind: "navigate",
      surface: "workflow_navigation",
      visibleTo: "all_viewers",
      usableForTargetBy: "all_viewers",
      effect: "Open analysis of authorized completed Nutrition observations.",
      destination: "/lifeswitch/nutrition/analyze",
      confirmation: "none",
      auditResult: "none",
    },
    {
      id: "nutrition.plan",
      label: "Plan",
      kind: "navigate",
      surface: "workflow_navigation",
      visibleTo: "all_viewers",
      usableForTargetBy: "all_viewers",
      effect: "Open authorized Nutrition targets in the unified Plan.",
      destination: "/lifeswitch/plan?section=nutrition",
      confirmation: "none",
      auditResult: "none",
    },
    {
      id: "nutrition.finish_day",
      label: "Finish day",
      kind: "mutate",
      surface: "page",
      visibleTo: "owner_only",
      usableForTargetBy: "owner_only",
      effect:
        "Mark the owner's current day finished so it becomes eligible for Plan scoring.",
      dataSourceId: "nutrition.day.completion",
      confirmation: "none",
      auditResult: "updated",
    },
    {
      id: "nutrition.reopen_day",
      label: "Reopen day",
      kind: "mutate",
      surface: "page",
      visibleTo: "owner_only",
      usableForTargetBy: "owner_only",
      effect:
        "Return the owner's current day to In progress and exclude it from Plan scoring.",
      dataSourceId: "nutrition.day.completion",
      confirmation: "none",
      auditResult: "updated",
    },
    {
      id: "nutrition.update_entry",
      label: "Save quantity",
      kind: "mutate",
      surface: "page",
      visibleTo: "owner_only",
      usableForTargetBy: "owner_only",
      effect: "Update the quantity and recompute the entry and day totals.",
      dataSourceId: "nutrition.entry.update",
      confirmation: "none",
      auditResult: "updated",
    },
    {
      id: "nutrition.delete_entry",
      label: "Delete entry",
      kind: "mutate",
      surface: "page",
      visibleTo: "owner_only",
      usableForTargetBy: "owner_only",
      effect: "Permanently remove an owned Nutrition entry.",
      dataSourceId: "nutrition.entry.delete",
      confirmation: "browser_confirm",
      auditResult: "deleted",
    },
    {
      id: "nutrition.recovery_details",
      label: "Recovery adjustment applied",
      kind: "disclosure",
      surface: "recovery_notice",
      visibleTo: "all_viewers",
      usableForTargetBy: "all_viewers",
      effect:
        "Explain that the current day is excluded from adherence while entries and totals remain unchanged.",
      dataSourceId: "nutrition.recovery_adjustments.current",
      confirmation: "none",
      auditResult: "none",
    },
  ],
  states: [
    {
      id: "loading",
      when: "The Nutrition range request is pending.",
      userMeaning: "Nutrition data is not ready.",
      helperGuidance: "Wait for loading to finish before interpreting logs.",
      recommendedControlIds: [],
      prohibitedClaims: [
        "No Nutrition logs exist.",
        "The displayed totals are final.",
      ],
    },
    {
      id: "ready",
      when: "The Nutrition range request succeeded and logged days exist.",
      userMeaning:
        "The page can explain logged days, finalized status, totals, and authorized Plan scoring.",
      helperGuidance:
        "Answer from the visible Nutrition observations and authorized Plan context using plain labels.",
      recommendedControlIds: [
        "nutrition.day_marker",
        "nutrition.day_summary",
        "nutrition.analyze",
      ],
      prohibitedClaims: [
        "An unlogged day proves that no food was consumed.",
        "An in-progress day failed the Plan.",
      ],
    },
    {
      id: "empty",
      when: "The Nutrition range request succeeded with no logged days.",
      userMeaning: "No Nutrition entries were returned for the visible window.",
      helperGuidance:
        "Direct the owner to Capture; tell a delegated viewer only that no authorized logs were returned.",
      recommendedControlIds: ["nutrition.capture"],
      prohibitedClaims: [
        "The person did not eat during this period.",
        "No older Nutrition records exist.",
      ],
    },
    {
      id: "load_error",
      when: "The Nutrition range request failed or returned an invalid response.",
      userMeaning: "Nutrition history could not be loaded reliably.",
      helperGuidance:
        "Report unavailable data and recommend reloading; never reinterpret the error as an empty history.",
      recommendedControlIds: [],
      prohibitedClaims: ["No Nutrition logs exist.", "The person did not eat."],
    },
    {
      id: "delegated_read_only",
      when: "target_user_id identifies another authorized person.",
      userMeaning:
        "The viewer may review authorized Nutrition logs but cannot change the target's records.",
      helperGuidance:
        "Offer read-only explanation and do not recommend target mutations.",
      recommendedControlIds: [
        "nutrition.day_marker",
        "nutrition.day_summary",
        "nutrition.analyze",
      ],
      prohibitedClaims: [
        "You can edit this person's entry.",
        "Capture will add Nutrition data for this person.",
      ],
    },
    {
      id: "recovery_adjustment_active",
      when: "An active Nutrition recovery period covers the current local day.",
      userMeaning:
        "Today is excluded from Nutrition adherence while entries and totals remain unchanged.",
      helperGuidance:
        "Explain the exclusion without saying that logs or Plan targets were deleted.",
      recommendedControlIds: ["nutrition.recovery_details", "nutrition.plan"],
      prohibitedClaims: [
        "Nutrition entries were removed.",
        "The Plan was automatically rewritten.",
      ],
    },
  ],
  workflow: {
    sequence: [
      "Plan defines Nutrition targets and scoring rules.",
      "Foods, meals, and meal plans provide reusable designs.",
      "Capture records Nutrition entries.",
      "Log reviews and, for the owner, corrects recorded entries.",
      "Analyze interprets eligible finalized observations.",
      "Plan revision changes future targets through a separate governed workflow.",
    ],
    entryPoints: [
      "/lifeswitch/nutrition/capture",
      "/lifeswitch/nutrition/analyze",
      "/lifeswitch/plan?section=nutrition",
    ],
    validNextControlIds: [
      "nutrition.capture",
      "nutrition.analyze",
      "nutrition.plan",
      "nutrition.day_marker",
      "nutrition.day_summary",
    ],
  },
  interpretationRules: [
    "A blue In progress day has entries but is not yet eligible for Plan scoring.",
    "A green Hit day is finalized and meets the configured evaluable Plan rule.",
    "An amber Not hit day is finalized and does not meet the configured evaluable Plan rule.",
    "No log means no Nutrition entries were returned for that day; it does not prove no food was consumed.",
    "Daily calorie, protein, carbohydrate, and fat totals are observations from recorded entries.",
    "Plan targets are goals and scoring rules, never evidence that food was logged.",
    "Delegated nutrition:view does not imply plan:view; explain logs without Plan interpretation when Plan context is blocked.",
    "An active Nutrition recovery day is excluded from adherence without changing its entries or totals.",
  ],
  responsePolicy: {
    must: [
      "Answer the user's question first in plain language.",
      "For a page overview, use no more than five short bullets and 140 words.",
      "Identify the page as a recent Nutrition log with daily totals and Plan-scored states.",
      "Explain that dates with logged data expand and No log dates are not proof of no food.",
      "Respect delegated read-only access and independent plan:view authorization.",
      "State when Nutrition or Plan data is unavailable without exposing implementation details.",
    ],
    mustNot: [
      "Output JSON, UUIDs, source paths, URL routes, schema names, field names, request limits, response limits, or status codes.",
      "Expose internal record counts, truncation flags, diagnostic values, or implementation details.",
      "Treat an in-progress day as Not hit.",
      "Treat No log as proof that no food was consumed.",
      "Offer owner-only mutations in a delegated view.",
      "Claim that Plan targets are actual recorded intake.",
      "Provide Behavior treatment, Verbal behavior analysis, general chat Memory, Fractal Monism, or web-search content.",
    ],
  },
  knownRisks: [
    "Plan scoring is not evaluable when required target rules are absent.",
    "The visible window is bounded and does not establish lifetime Nutrition history.",
    "Delegated Nutrition and Plan permissions are independent.",
    "The current day remains In progress until the owner finishes it.",
  ],
  evidence: {
    verifiedAt: "2026-07-30",
    frontendRevision: "54a0e87d252dbc6a0fcef1ccd0dffa1a5c651aab",
    backendRevision: "f7ace0f304ef18aec6e92bcd72b1269945c28167",
    sources: [
      {
        system: "frontend",
        path: "app/lifeswitch/nutrition/log/page.tsx",
        symbols: [
          "NutritionLogPage",
          "MonthCalendar",
          "targetHit",
          "setDayCompletion",
        ],
        proves:
          "Visible states, 60-day range, Plan scoring, day expansion, delegated read-only behavior, and owner mutations.",
      },
      {
        system: "frontend",
        path: "lib/lifeswitch/planNutritionTargets.ts",
        symbols: ["readPlanNutritionTargets"],
        proves:
          "Normalization of daily and rolling calorie and protein target rules.",
      },
      {
        system: "frontend",
        path: "lib/lifeswitch/nutritionScoring.ts",
        symbols: ["scoreNutritionDay", "scoreNutritionRollingWindow"],
        proves:
          "Exact Hit, Not hit, In progress, No log, and rolling Plan semantics.",
      },
      {
        system: "frontend",
        path: "lib/lifeswitch/sage/nutritionLogContext.ts",
        symbols: ["buildNutritionLogSageContext"],
        proves:
          "Server-owned authorized Nutrition, Plan, and recovery context assembly.",
      },
      {
        system: "frontend",
        path: "app/api/lifeswitch/helper/respond/route.ts",
        symbols: ["POST"],
        proves:
          "Fresh authentication, strict request parsing, fail-closed contract dispatch, and stateless Sage invocation.",
      },
      {
        system: "backend",
        path: "rag_engine/lifeswitch_nutrition_log_router.py",
        symbols: [
          "_resolve_nutrition_view_target",
          "get_log_range",
          "get_log_day",
        ],
        proves:
          "nutrition:view enforcement and owner-only mutation boundaries.",
      },
      {
        system: "backend",
        path: "lifeswitch_agentic/plan_api.py",
        symbols: ["get_active_plan", "list_recovery_adjustments"],
        proves: "Independent Plan authorization and active recovery context.",
      },
      {
        system: "backend",
        path: "rag_engine/lifeswitch_sage_router.py",
        symbols: ["LifeSwitchSageRequestV1", "lifeswitch_sage_query"],
        proves:
          "Stateless OpenAI generation with governed Memory, FM, and web search disabled.",
      },
    ],
  },
} as const satisfies SagePageContract;
