import type { SagePageContract } from "../pageContract";

export const trainingCalendarContract = {
  schemaVersion: "1.0",
  contractVersion: "2026-07-29.2",
  pageId: "training.calendar",
  status: "active",
  domain: "training",
  route: {
    canonicalPath: "/lifeswitch/training/calendar",
    aliases: ["/lifeswitch/training", "/lifeswitch/training/log"],
    queryParameters: [
      {
        name: "target_user_id",
        purpose: "Select an authorized delegated training-data target.",
        authority: "authorization_target",
      },
      {
        name: "target_name",
        purpose: "Display-only label for an authorized delegated target.",
        authority: "display_hint",
      },
      {
        name: "debug",
        purpose: "Expose local request and record counts when set to 1.",
        authority: "diagnostic",
      },
    ],
  },
  purpose: {
    summary:
      "Review active completed resistance sessions and active conditioning logs, grouped by month.",
    userGoals: [
      "See which dates contain completed strength, rehab, or conditioning records.",
      "Review monthly strength and conditioning summaries.",
      "Open a completed resistance session for detail.",
      "Remove an owned log while preserving its audit history.",
      "Understand the next valid Training workflow step.",
    ],
    nonGoals: [
      "Create or complete a resistance or conditioning session.",
      "Design exercises, workouts, or conditioning prescriptions.",
      "Edit the unified Plan.",
      "Treat calendar day numbers as selectable logging controls.",
      "Claim that the returned 250-record limits represent unlimited history.",
    ],
  },
  access: {
    authenticationRequired: true,
    selfView: "owner",
    delegatedView: {
      allowed: true,
      permission: "training:view",
      mode: "read_only",
    },
    mutations: {
      selfOnly: true,
      backendInvariant:
        "The backend requires the authenticated actor to match owner_user_id; deactivation routes do not accept a delegated target.",
    },
  },
  planContext: {
    sections: [
      "primary_goal",
      "phase",
      "training_targets",
      "conditioning_targets",
      "recovery_targets",
      "monitoring_rules",
    ],
    purpose:
      "Interpret completed Training records against the current authorized Plan without changing either source.",
    missingBehavior:
      "State that Plan-based interpretation is unavailable; continue explaining the page and observed records without inventing targets.",
    mutationPolicy: "read_only_context",
  },
  dataSources: [
    {
      id: "training.sessions.list",
      consumer: "page",
      operation: "read",
      method: "GET",
      frontendPath: "/api/lifeswitch/training/sessions?limit=250",
      upstreamPath: "/lifeswitch/training/sessions",
      purpose:
        "Return active finished resistance sessions containing at least one active set, including strength, rehab, mixed, and unclassified rollups.",
      authorization: "authenticated_owner_or_training_view",
      resultBoundary:
        "At most 250 rows; delegated reads require training:view; inactive and unfinished sessions are excluded.",
      failureBehavior:
        "Do not interpret a request failure as an empty training history.",
    },
    {
      id: "training.conditioning_sessions.list",
      consumer: "page",
      operation: "read",
      method: "GET",
      frontendPath: "/api/lifeswitch/training/conditioning_sessions?limit=250",
      upstreamPath: "/lifeswitch/training/conditioning_sessions",
      purpose: "Return active conditioning-session logs.",
      authorization: "authenticated_owner_or_training_view",
      resultBoundary:
        "At most 250 rows; delegated reads require training:view; inactive rows are excluded.",
      failureBehavior:
        "Do not interpret a request failure as an empty conditioning history.",
    },
    {
      id: "training.recovery_adjustments.current",
      consumer: "page",
      operation: "read",
      method: "GET",
      frontendPath: "/api/lifeswitch/plan/agentic/recovery-adjustments",
      upstreamPath: "/lifeswitch/plan/recovery-adjustments",
      purpose:
        "Determine whether strength adherence is paused for the current local day.",
      authorization: "authenticated_owner_or_plan_view",
      resultBoundary:
        "Only an authorized active adjustment that covers the current day is displayed.",
      failureBehavior:
        "The log remains usable; do not claim that no recovery adjustment exists.",
    },
    {
      id: "plan.profile.current",
      consumer: "helper",
      operation: "read",
      method: "GET",
      frontendPath: "/api/lifeswitch/helper/respond",
      upstreamPath: "/lifeswitch/plan/profile",
      purpose:
        "Supply the authorized current Plan sections required for Training interpretation.",
      authorization: "authenticated_owner_or_plan_view",
      resultBoundary:
        "Plan data is optional and permission-scoped; delegated access requires plan:view independently of training:view.",
      failureBehavior:
        "Continue with page guidance and observed Training data, and state that Plan-based interpretation is unavailable.",
    },
    {
      id: "training.sessions.deactivate",
      consumer: "page",
      operation: "mutate",
      method: "POST",
      frontendPath:
        "/api/lifeswitch/training/sessions/{training_session_id}/deactivate",
      upstreamPath:
        "/lifeswitch/training/sessions/{training_session_id}/deactivate",
      purpose:
        "Void an owned resistance-session log after explicit confirmation.",
      authorization: "authenticated_owner_self_only",
      resultBoundary:
        "The active log is removed from current views while audit history is preserved.",
      failureBehavior:
        "Report that removal failed and retain the current record.",
    },
    {
      id: "training.conditioning_sessions.deactivate",
      consumer: "page",
      operation: "mutate",
      method: "POST",
      frontendPath:
        "/api/lifeswitch/training/conditioning_sessions/{conditioning_session_log_id}/deactivate",
      upstreamPath:
        "/lifeswitch/training/conditioning_sessions/{conditioning_session_log_id}/deactivate",
      purpose:
        "Void an owned conditioning-session log after explicit confirmation.",
      authorization: "authenticated_owner_self_only",
      resultBoundary:
        "The active log is removed from current views while audit history is preserved.",
      failureBehavior:
        "Report that removal failed and retain the current record.",
    },
  ],
  controls: [
    {
      id: "calendar.refresh",
      label: "Refresh",
      kind: "refresh",
      surface: "page",
      visibleTo: "all_viewers",
      usableForTargetBy: "all_viewers",
      effect: "Reload resistance and conditioning logs for the current target.",
      dataSourceId: "training.sessions.list",
      confirmation: "none",
      auditResult: "none",
    },
    {
      id: "calendar.day_marker",
      label: "Calendar day",
      kind: "display",
      surface: "page",
      visibleTo: "all_viewers",
      usableForTargetBy: "nobody",
      effect:
        "Display strength, conditioning, both, or no-log state for a date; it is not interactive.",
      confirmation: "none",
      auditResult: "none",
    },
    {
      id: "calendar.view_strength_session",
      label: "View",
      kind: "navigate",
      surface: "session_action_menu",
      visibleTo: "all_viewers",
      usableForTargetBy: "all_viewers",
      effect: "Open the selected completed resistance-session detail.",
      destination:
        "/lifeswitch/training/session?session_id={training_session_id}",
      confirmation: "none",
      auditResult: "none",
    },
    {
      id: "calendar.remove_strength_session",
      label: "Delete",
      kind: "mutate",
      surface: "session_action_menu",
      visibleTo: "owner_only",
      usableForTargetBy: "owner_only",
      effect:
        "Remove the owned resistance-session log from current views by writing an audit-preserving void.",
      dataSourceId: "training.sessions.deactivate",
      confirmation: "browser_confirm",
      auditResult: "preserved",
    },
    {
      id: "calendar.remove_conditioning_session",
      label: "Delete",
      kind: "mutate",
      surface: "session_action_menu",
      visibleTo: "owner_only",
      usableForTargetBy: "owner_only",
      effect:
        "Remove the owned conditioning-session log from current views by writing an audit-preserving void.",
      dataSourceId: "training.conditioning_sessions.deactivate",
      confirmation: "browser_confirm",
      auditResult: "preserved",
    },
    {
      id: "training.workouts",
      label: "Workouts",
      kind: "navigate",
      surface: "workflow_navigation",
      visibleTo: "all_viewers",
      usableForTargetBy: "owner_only",
      effect: "Open the viewer's workout-design workspace.",
      destination: "/lifeswitch/training/design/workouts",
      confirmation: "none",
      auditResult: "none",
    },
    {
      id: "training.capture",
      label: "Capture",
      kind: "navigate",
      surface: "workflow_navigation",
      visibleTo: "all_viewers",
      usableForTargetBy: "owner_only",
      effect: "Open the viewer's Training Capture workflow.",
      destination: "/lifeswitch/training/capture",
      confirmation: "none",
      auditResult: "none",
    },
    {
      id: "training.plan",
      label: "Plan",
      kind: "navigate",
      surface: "workflow_navigation",
      visibleTo: "all_viewers",
      usableForTargetBy: "owner_only",
      effect: "Open the viewer's Training section of the unified Plan.",
      destination: "/lifeswitch/plan?section=training#training-targets",
      confirmation: "none",
      auditResult: "none",
    },
    {
      id: "training.analyze",
      label: "Analyze",
      kind: "navigate",
      surface: "workflow_navigation",
      visibleTo: "all_viewers",
      usableForTargetBy: "owner_only",
      effect: "Open the viewer's Training analysis page.",
      destination: "/lifeswitch/training/analyze",
      confirmation: "none",
      auditResult: "none",
    },
    {
      id: "calendar.recovery_details",
      label: "Recovery adjustment applied",
      kind: "disclosure",
      surface: "recovery_notice",
      visibleTo: "all_viewers",
      usableForTargetBy: "all_viewers",
      effect:
        "Explain the active strength-adherence pause without changing training history.",
      dataSourceId: "training.recovery_adjustments.current",
      confirmation: "none",
      auditResult: "none",
    },
    {
      id: "calendar.recovery_plan",
      label: "View in Plan",
      kind: "navigate",
      surface: "recovery_notice",
      visibleTo: "all_viewers",
      usableForTargetBy: "all_viewers",
      effect:
        "Open the authorized target's Plan from an active recovery notice.",
      destination: "/lifeswitch/plan",
      confirmation: "none",
      auditResult: "none",
    },
  ],
  states: [
    {
      id: "loading",
      when: "Either Training log request is pending.",
      userMeaning: "Calendar data is not ready.",
      helperGuidance: "Wait for loading to finish before interpreting records.",
      recommendedControlIds: [],
      prohibitedClaims: [
        "No sessions exist.",
        "The displayed totals are final.",
      ],
    },
    {
      id: "ready",
      when: "Both Training log requests succeeded and at least one row exists.",
      userMeaning:
        "Returned records are grouped by month and sorted newest first.",
      helperGuidance:
        "Explain only records, metrics, and controls represented by the contract and authorized context.",
      recommendedControlIds: [
        "calendar.view_strength_session",
        "training.analyze",
      ],
      prohibitedClaims: [
        "The page contains every historical record without limit.",
        "A calendar day can be selected to log a session.",
      ],
    },
    {
      id: "empty",
      when: "Both Training log requests succeeded and returned no rows.",
      userMeaning: "No active completed Training logs were returned.",
      helperGuidance:
        "Direct the owner to Training Capture; tell a delegated viewer only that no authorized completed logs were returned.",
      recommendedControlIds: ["training.capture"],
      prohibitedClaims: [
        "A calendar day can be selected to create a session.",
        "No unfinished or inactive records exist.",
      ],
    },
    {
      id: "load_error",
      when: "Either Training log request fails.",
      userMeaning: "Training history could not be loaded reliably.",
      helperGuidance:
        "Report unavailable data and recommend Refresh; never reinterpret the error as an empty history.",
      recommendedControlIds: ["calendar.refresh"],
      prohibitedClaims: [
        "No training sessions exist.",
        "The user has not trained.",
      ],
    },
    {
      id: "delegated_read_only",
      when: "target_user_id identifies another authorized person.",
      userMeaning:
        "The viewer may review the authorized target's Training logs but cannot remove or create target records.",
      helperGuidance:
        "Offer read-only explanation and session viewing; do not recommend target mutations.",
      recommendedControlIds: ["calendar.view_strength_session"],
      prohibitedClaims: [
        "You can delete this person's session.",
        "Capture will add a session for this person.",
      ],
    },
    {
      id: "recovery_adjustment_active",
      when: "An active strength recovery period covers the current local day.",
      userMeaning:
        "Strength adherence is paused for the stated period; Training history remains unchanged.",
      helperGuidance:
        "Explain the pause and distinguish it from deletion or modification of logged sessions.",
      recommendedControlIds: [
        "calendar.recovery_details",
        "calendar.recovery_plan",
      ],
      prohibitedClaims: [
        "Training records were removed.",
        "The Plan was automatically rewritten.",
      ],
    },
  ],
  workflow: {
    sequence: [
      "Plan defines Training targets and constraints.",
      "Workouts and conditioning are designed.",
      "Training Capture records and completes sessions.",
      "Calendar reviews completed logs.",
      "Analyze interprets completed data.",
      "Plan revision changes future targets through a separate governed workflow.",
    ],
    entryPoints: [
      "/lifeswitch/training/capture",
      "/lifeswitch/training/session",
      "/lifeswitch/training/analyze",
      "/lifeswitch/plan?section=training",
    ],
    validNextControlIds: [
      "training.workouts",
      "training.capture",
      "training.plan",
      "training.analyze",
      "calendar.view_strength_session",
    ],
  },
  interpretationRules: [
    "The page requests at most 250 resistance sessions and 250 conditioning sessions.",
    "Resistance rows are active, finished, and contain at least one active set.",
    "The Workouts metric and strength calendar markers count strength or mixed sessions, not rehab-only or unclassified sessions.",
    "Strength Sets and Volume use strength-only rollups when available.",
    "Rehab-only and unclassified sessions remain visible in the session list.",
    "Conditioning metrics count active conditioning logs and sum their duration_min values.",
    "Calendar day numbers are non-interactive display markers.",
    "Removing a log writes a void and preserves audit history.",
    "Plan targets are interpretive context and never proof that a session occurred.",
  ],
  responsePolicy: {
    must: [
      "Identify this page as a completed Training log and calendar.",
      "Use Training Capture as the owner workflow for recording or completing a session.",
      "Distinguish observed Training records from Plan targets.",
      "Respect delegated read-only access and independent plan:view authorization.",
      "State when Training or Plan data is missing, blocked, limited, or unavailable.",
    ],
    mustNot: [
      "Tell the user to select a calendar date to log a session.",
      "Claim that calendar day markers are buttons or links.",
      "Offer deletion or target mutation in a delegated view.",
      "Treat a request failure as proof of no Training history.",
      "Describe the returned rows as unlimited lifetime history.",
      "Count rehab-only or unclassified sessions as strength workouts.",
      "Claim that Plan targets are actual completed sessions.",
    ],
  },
  knownRisks: [
    "The current page renders the same visible empty state after a load failure unless debug=1 exposes status.",
    "Rehab-only sessions appear in the session list but their date is labeled no log unless conditioning also exists.",
    "Shared workflow navigation does not preserve delegated target query parameters.",
    "Only Training Calendar and its compatibility aliases use the server-owned contract runtime during this pilot; other LifeSwitch pages retain the legacy helper path.",
  ],
  evidence: {
    verifiedAt: "2026-07-29",
    frontendRevision: "4ed626af03a0941f442978549c4c94f06e8d7d3f",
    backendRevision: "8ee7b2d735f06f6b221c6bd9be260b0e35c2a6a4",
    sources: [
      {
        system: "frontend",
        path: "app/lifeswitch/training/calendar/page.tsx",
        symbols: [
          "TrainingCalendarPage",
          "MonthCalendar",
          "loadSessions",
          "deleteSession",
          "deleteConditioningSession",
        ],
        proves:
          "Visible controls, state handling, grouping, metrics, query parameters, navigation, and mutations.",
      },
      {
        system: "frontend",
        path: "components/lifeswitch/LifeSwitchModeNav.tsx",
        symbols: ["LifeSwitchModeNav", "planHrefForDomain"],
        proves: "Training workflow navigation and canonical destinations.",
      },
      {
        system: "frontend",
        path: "components/lifeswitch/RecoveryAdjustmentApplied.tsx",
        symbols: ["RecoveryAdjustmentApplied"],
        proves:
          "Current-day recovery notice, failure behavior, and Plan navigation.",
      },
      {
        system: "frontend",
        path: "lib/lifeswitch/sage/trainingCalendarContext.ts",
        symbols: ["buildTrainingCalendarSageContext"],
        proves:
          "Page-specific Training, Plan, and recovery context is fetched through independent permission boundaries without unrelated domains.",
      },
      {
        system: "frontend",
        path: "app/api/lifeswitch/helper/respond/route.ts",
        symbols: ["POST"],
        proves:
          "Fresh authentication, strict request parsing, fail-closed contract resolution, and the internal no-store Sage runtime call.",
      },
      {
        system: "frontend",
        path: "lib/lifeswitch/sage/helperPrompt.ts",
        symbols: ["buildSageHelperPrompt"],
        proves:
          "Server-owned prompt authority, viewer-specific controls, explicit scope exclusions, and untrusted-data separation.",
      },
      {
        system: "backend",
        path: "rag_engine/lifeswitch_training_router.py",
        symbols: [
          "_resolve_training_view_target",
          "list_training_sessions",
          "list_conditioning_sessions",
          "deactivate_training_session",
          "deactivate_conditioning_session",
        ],
        proves:
          "Server-enforced delegated training:view and self-owned audit-preserving deactivation.",
      },
      {
        system: "backend",
        path: "rag_engine/lifeswitch_sage_router.py",
        symbols: ["LifeSwitchSageRequestV1", "lifeswitch_sage_query"],
        proves:
          "Dedicated stateless OpenAI generation with general Memory, Fractal Monism, and web search disabled.",
      },
    ],
  },
} as const satisfies SagePageContract;
