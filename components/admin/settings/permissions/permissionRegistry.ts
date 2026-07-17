export type PermissionRole =
  | "owner"
  | "admin"
  | "developer"
  | "operator"
  | "beta_tester"
  | "power_user"
  | "user";

export type PermissionScope =
  | "global"
  | "own_account"
  | "shared_user"
  | "workspace"
  | "system";

export type PermissionAccess =
  | "hidden"
  | "view"
  | "use"
  | "edit"
  | "manage"
  | "delete";

export type PermissionRisk = "low" | "medium" | "high" | "critical";

export type PermissionCategory =
  | "assistant_profile"
  | "inspection"
  | "diagnostics"
  | "voice"
  | "memory"
  | "admin_console"
  | "account_data"
  | "lifeswitch"
  | "system";

export type CapabilityDefinition = {
  key: string;
  label: string;
  description: string;
  category: PermissionCategory;
  scope: PermissionScope;
  access: PermissionAccess;
  risk: PermissionRisk;
  defaultRoles: PermissionRole[];
  backendEnforced: boolean;
  notes?: string;
};

export const PERMISSION_ROLES: { key: PermissionRole; label: string; description: string }[] = [
  {
    key: "owner",
    label: "Owner",
    description: "Full system authority. Intended for the product owner/root operator.",
  },
  {
    key: "admin",
    label: "Admin",
    description: "Broad administrative access for trusted system administrators.",
  },
  {
    key: "developer",
    label: "Developer",
    description: "Technical diagnostics and development access without default destructive data authority.",
  },
  {
    key: "operator",
    label: "Operator",
    description: "Support/operations role for managing system health and routine non-destructive tasks.",
  },
  {
    key: "beta_tester",
    label: "Beta Tester",
    description: "Trusted tester role for experimental features without administrative system access.",
  },
  {
    key: "power_user",
    label: "Power User",
    description: "Advanced normal user with expanded personal configuration controls.",
  },
  {
    key: "user",
    label: "User",
    description: "Default normal account role.",
  },
];

export const CAPABILITY_REGISTRY: CapabilityDefinition[] = [
  // Assistant Profile / Vantage controls
  {
    key: "assistant_profile.view",
    label: "View Assistant Profile",
    description: "See the active Assistant Profile and profile settings page.",
    category: "assistant_profile",
    scope: "own_account",
    access: "view",
    risk: "low",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: false,
  },
  {
    key: "assistant_profile.apply_builtin",
    label: "Apply Built-in Profiles",
    description: "Apply built-in profiles such as RESSE, MORGAN, or RILEY.",
    category: "assistant_profile",
    scope: "own_account",
    access: "use",
    risk: "low",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: true,
  },
  {
    key: "assistant_profile.create_custom",
    label: "Create Custom Profiles",
    description: "Create and save custom Assistant Profiles.",
    category: "assistant_profile",
    scope: "own_account",
    access: "edit",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer", "beta_tester", "power_user", "user"],
    backendEnforced: true,
  },
  {
    key: "assistant_profile.edit_basic",
    label: "Edit Basic Profile Levers",
    description: "Edit normal visible profile controls such as thread context, memory weight, corpus, lens, and routing.",
    category: "assistant_profile",
    scope: "own_account",
    access: "edit",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer", "beta_tester", "power_user", "user"],
    backendEnforced: true,
  },
  {
    key: "assistant_profile.edit_advanced",
    label: "Edit Advanced Profile Levers",
    description: "Edit advanced profile controls that can materially affect retrieval, tone, initiative, or response shape.",
    category: "assistant_profile",
    scope: "own_account",
    access: "edit",
    risk: "high",
    defaultRoles: ["owner", "admin", "developer", "power_user"],
    backendEnforced: true,
  },
  {
    key: "assistant_profile.edit_admin_levers",
    label: "Edit Admin Profile Levers",
    description: "Edit hidden/admin-only Vantage levers such as pragmatics, limits, strictness, and low-level behavior constraints.",
    category: "assistant_profile",
    scope: "own_account",
    access: "manage",
    risk: "critical",
    defaultRoles: ["owner", "admin", "developer"],
    backendEnforced: true,
  },

  // Inspection / diagnostics
  {
    key: "inspector.view",
    label: "View Prompt Inspector",
    description: "View prompt, memory, corpus, and routing/debug metadata for chat turns.",
    category: "inspection",
    scope: "system",
    access: "view",
    risk: "critical",
    defaultRoles: ["owner", "admin", "developer"],
    backendEnforced: true,
    notes: "Currently enforced as admin-only. Later developer access should be explicit.",
  },
  {
    key: "diagnostics.view",
    label: "View Diagnostics",
    description: "Open model/system diagnostic panels.",
    category: "diagnostics",
    scope: "system",
    access: "view",
    risk: "high",
    defaultRoles: ["owner", "admin", "developer", "operator"],
    backendEnforced: true,
  },
  {
    key: "diagnostics.run",
    label: "Run Diagnostics",
    description: "Run diagnostic probes or test suites that may create telemetry.",
    category: "diagnostics",
    scope: "system",
    access: "use",
    risk: "high",
    defaultRoles: ["owner", "admin", "developer"],
    backendEnforced: true,
  },

  {
    key: "voice.realtime_token",
    label: "Use Realtime Voice",
    description: "Start an authenticated OpenAI Realtime WebRTC voice session.",
    category: "voice",
    scope: "own_account",
    access: "use",
    risk: "high",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: true,
  },

  // Memory
  {
    key: "memory_cards.view",
    label: "View Memory Cards",
    description: "View structured memory cards and Vantage-scoped card summaries.",
    category: "memory",
    scope: "own_account",
    access: "view",
    risk: "high",
    defaultRoles: ["owner", "admin", "developer"],
    backendEnforced: true,
  },
  {
    key: "memory_cards.view_raw",
    label: "View Raw Memory Payloads",
    description: "View raw card payloads, source metadata, and internal memory diagnostics.",
    category: "memory",
    scope: "own_account",
    access: "view",
    risk: "critical",
    defaultRoles: ["owner", "admin", "developer"],
    backendEnforced: true,
  },
  {
    key: "memory_cards.edit",
    label: "Edit Memory Cards",
    description: "Create or modify memory cards.",
    category: "memory",
    scope: "own_account",
    access: "edit",
    risk: "critical",
    defaultRoles: ["owner", "admin"],
    backendEnforced: true,
  },
  {
    key: "memory_cards.delete",
    label: "Delete Memory Cards",
    description: "Delete or retire memory cards.",
    category: "memory",
    scope: "own_account",
    access: "delete",
    risk: "critical",
    defaultRoles: ["owner", "admin"],
    backendEnforced: true,
  },
  {
    key: "memory_system.view",
    label: "View Memory System Status",
    description: "View memory architecture status, active layers, and retrieval/prompt-injection diagnostics.",
    category: "memory",
    scope: "system",
    access: "view",
    risk: "high",
    defaultRoles: ["owner", "admin", "developer"],
    backendEnforced: true,
  },
  {
    key: "memory_system.manage",
    label: "Manage Memory System",
    description: "Change memory-layer settings, gates, or migration behavior.",
    category: "memory",
    scope: "system",
    access: "manage",
    risk: "critical",
    defaultRoles: ["owner", "admin"],
    backendEnforced: true,
  },

  // Admin console
  {
    key: "admin_console.view",
    label: "View Admin Console",
    description: "Open the Admin Console shell.",
    category: "admin_console",
    scope: "system",
    access: "view",
    risk: "high",
    defaultRoles: ["owner", "admin", "developer"],
    backendEnforced: true,
  },
  {
    key: "permissions.view",
    label: "View Permissions",
    description: "View role and capability configuration.",
    category: "admin_console",
    scope: "system",
    access: "view",
    risk: "high",
    defaultRoles: ["owner", "admin", "developer"],
    backendEnforced: true,
  },
  {
    key: "permissions.manage",
    label: "Manage Permissions",
    description: "Change role/capability assignments and permission policies.",
    category: "admin_console",
    scope: "system",
    access: "manage",
    risk: "critical",
    defaultRoles: ["owner", "admin"],
    backendEnforced: true,
  },

  // Account / data
  {
    key: "user_data.export",
    label: "Export User Data",
    description: "Export user data from admin/security tools.",
    category: "account_data",
    scope: "own_account",
    access: "use",
    risk: "critical",
    defaultRoles: ["owner", "admin"],
    backendEnforced: true,
  },
  {
    key: "user_data.delete",
    label: "Delete User Data",
    description: "Delete account-linked user data through admin/security tools.",
    category: "account_data",
    scope: "own_account",
    access: "delete",
    risk: "critical",
    defaultRoles: ["owner", "admin"],
    backendEnforced: true,
  },
  {
    key: "user_data.forget_recent",
    label: "Forget Recent Data",
    description: "Forget or clear recent chat/memory material.",
    category: "account_data",
    scope: "own_account",
    access: "delete",
    risk: "critical",
    defaultRoles: ["owner", "admin"],
    backendEnforced: true,
  },

  // LifeSwitch future scoped permissions
  {
    key: "lifeswitch.view_own",
    label: "View Own LifeSwitch Data",
    description: "View the user's own LifeSwitch plan/log/analysis data.",
    category: "lifeswitch",
    scope: "own_account",
    access: "view",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: true,
  },
  {
    key: "lifeswitch.edit_own",
    label: "Edit Own LifeSwitch Data",
    description: "Create or modify the user's own LifeSwitch data.",
    category: "lifeswitch",
    scope: "own_account",
    access: "edit",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: true,
  },
  {
    key: "lifeswitch.view_shared",
    label: "View Shared LifeSwitch Data",
    description: "View LifeSwitch data shared by another user.",
    category: "lifeswitch",
    scope: "shared_user",
    access: "view",
    risk: "high",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: true,
  },
  {
    key: "lifeswitch.comment_shared",
    label: "Comment on Shared LifeSwitch Data",
    description: "Comment on another user's shared LifeSwitch data.",
    category: "lifeswitch",
    scope: "shared_user",
    access: "use",
    risk: "high",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: true,
  },
  {
    key: "lifeswitch.edit_shared",
    label: "Edit Shared LifeSwitch Data",
    description: "Modify another user's LifeSwitch data when explicitly granted.",
    category: "lifeswitch",
    scope: "shared_user",
    access: "edit",
    risk: "critical",
    defaultRoles: ["owner", "admin"],
    backendEnforced: true,
  },
  {
    key: "lifeswitch.manage_relationships",
    label: "Manage LifeSwitch Relationships",
    description: "Create, revoke, or change LifeSwitch sharing relationships and permissions.",
    category: "lifeswitch",
    scope: "own_account",
    access: "manage",
    risk: "critical",
    defaultRoles: ["owner", "admin", "power_user", "user"],
    backendEnforced: true,
  },

  // LifeSwitch module vocabulary for future tiering/capability mapping.
  // These are planning-level registry entries for now. Relationship-specific
  // delegated access is still enforced by Brains scopes such as training:view,
  // nutrition:view, measurements:view, plan:view, plan:comment, and plan:edit.
  {
    key: "lifeswitch.training.view",
    label: "View Training Module",
    description: "View LifeSwitch training calendar, sessions, workouts, and analysis surfaces.",
    category: "lifeswitch",
    scope: "own_account",
    access: "view",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: false,
    notes: "Future module/tier capability. Not yet used as a route gate.",
  },
  {
    key: "lifeswitch.training.edit",
    label: "Edit Training Module",
    description: "Create or modify the user's own LifeSwitch training data.",
    category: "lifeswitch",
    scope: "own_account",
    access: "edit",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: false,
    notes: "Future module/tier capability. Not yet used as a route gate.",
  },
  {
    key: "lifeswitch.nutrition.view",
    label: "View Nutrition Module",
    description: "View LifeSwitch nutrition logs, foods, meals, targets, and analysis surfaces.",
    category: "lifeswitch",
    scope: "own_account",
    access: "view",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: false,
    notes: "Future module/tier capability. Not yet used as a route gate.",
  },
  {
    key: "lifeswitch.nutrition.edit",
    label: "Edit Nutrition Module",
    description: "Create or modify the user's own LifeSwitch nutrition data.",
    category: "lifeswitch",
    scope: "own_account",
    access: "edit",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: false,
    notes: "Future module/tier capability. Not yet used as a route gate.",
  },
  {
    key: "lifeswitch.measurements.view",
    label: "View Measurements Module",
    description: "View LifeSwitch body measurements, body composition entries, and trends.",
    category: "lifeswitch",
    scope: "own_account",
    access: "view",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: false,
    notes: "Future module/tier capability. Not yet used as a route gate.",
  },
  {
    key: "lifeswitch.measurements.edit",
    label: "Edit Measurements Module",
    description: "Create or modify the user's own LifeSwitch measurement data.",
    category: "lifeswitch",
    scope: "own_account",
    access: "edit",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: false,
    notes: "Future module/tier capability. Not yet used as a route gate.",
  },
  {
    key: "lifeswitch.plan.view",
    label: "View Unified Plan",
    description: "View the user's unified LifeSwitch plan.",
    category: "lifeswitch",
    scope: "own_account",
    access: "view",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: false,
    notes: "Future module/tier capability. Not yet used as a route gate.",
  },
  {
    key: "lifeswitch.plan.edit",
    label: "Edit Unified Plan",
    description: "Create or modify the user's unified LifeSwitch plan.",
    category: "lifeswitch",
    scope: "own_account",
    access: "edit",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: false,
    notes: "Future module/tier capability. Not yet used as a route gate.",
  },
  {
    key: "lifeswitch.helper.use",
    label: "Use LifeSwitch Helper",
    description: "Use the LifeSwitch helper and helper context surfaces.",
    category: "lifeswitch",
    scope: "own_account",
    access: "use",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: false,
    notes: "Future module/tier capability. Not yet used as a route gate.",
  },
  {
    key: "lifeswitch.analysis.use",
    label: "Use LifeSwitch Analysis",
    description: "Use LifeSwitch analysis and trend interpretation surfaces.",
    category: "lifeswitch",
    scope: "own_account",
    access: "use",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer", "operator", "beta_tester", "power_user", "user"],
    backendEnforced: false,
    notes: "Future module/tier capability. Not yet used as a route gate.",
  },
  {
    key: "lifeswitch.behavior.view",
    label: "View Behavior Module",
    description: "View the future/hidden LifeSwitch behavior module.",
    category: "lifeswitch",
    scope: "own_account",
    access: "view",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer"],
    backendEnforced: false,
    notes: "Future/hidden module. Not part of the current primary product surface.",
  },
  {
    key: "lifeswitch.behavior.edit",
    label: "Edit Behavior Module",
    description: "Create or modify data in the future/hidden LifeSwitch behavior module.",
    category: "lifeswitch",
    scope: "own_account",
    access: "edit",
    risk: "high",
    defaultRoles: ["owner", "admin", "developer"],
    backendEnforced: false,
    notes: "Future/hidden module. Not part of the current primary product surface.",
  },
  {
    key: "lifeswitch.verbal.view",
    label: "View Verbal Module",
    description: "View the future/hidden LifeSwitch verbal behavior module.",
    category: "lifeswitch",
    scope: "own_account",
    access: "view",
    risk: "medium",
    defaultRoles: ["owner", "admin", "developer"],
    backendEnforced: false,
    notes: "Future/hidden module. Not part of the current primary product surface.",
  },
  {
    key: "lifeswitch.verbal.edit",
    label: "Edit Verbal Module",
    description: "Create or modify data in the future/hidden LifeSwitch verbal behavior module.",
    category: "lifeswitch",
    scope: "own_account",
    access: "edit",
    risk: "high",
    defaultRoles: ["owner", "admin", "developer"],
    backendEnforced: false,
    notes: "Future/hidden module. Not part of the current primary product surface.",
  },
];

export function capabilitiesForRole(role: PermissionRole): CapabilityDefinition[] {
  return CAPABILITY_REGISTRY.filter((cap) => cap.defaultRoles.includes(role));
}

export function roleHasCapability(role: PermissionRole, capabilityKey: string): boolean {
  return CAPABILITY_REGISTRY.some((cap) => cap.key === capabilityKey && cap.defaultRoles.includes(role));
}

export function capabilitiesByCategory(): Record<PermissionCategory, CapabilityDefinition[]> {
  return CAPABILITY_REGISTRY.reduce((acc, cap) => {
    (acc[cap.category] ||= []).push(cap);
    return acc;
  }, {} as Record<PermissionCategory, CapabilityDefinition[]>);
}
