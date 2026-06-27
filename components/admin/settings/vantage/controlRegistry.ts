export type VantageControlCategory =
  | "context"
  | "retrieval"
  | "lens"
  | "routing"
  | "social"
  | "limiters"
  | "future";

export type VantageControlAudience = "user" | "power_user" | "admin";

export type VantageControlStatus =
  | "stable"
  | "experimental"
  | "future"
  | "deprecated";

export type VantageControlRisk = "low" | "medium" | "high";

export type VantageControlDefinition = {
  key: string;
  label: string;
  description: string;
  category: VantageControlCategory;
  audience: VantageControlAudience;
  status: VantageControlStatus;
  risk: VantageControlRisk;
  currentField?: string;
};

export const VANTAGE_CONTROL_REGISTRY: VantageControlDefinition[] = [
  {
    key: "conversation",
    label: "Thread context",
    description: "Controls how much recent thread conversation is included as context.",
    category: "context",
    audience: "user",
    status: "stable",
    risk: "low",
    currentField: "mix.conversation",
  },
  {
    key: "memory_cards",
    label: "Personal memory",
    description: "Controls how much personal vector memory is retrieved when personal memory is enabled.",
    category: "retrieval",
    audience: "user",
    status: "stable",
    risk: "medium",
    currentField: "mix.memory_cards",
  },
  {
    key: "corpus",
    label: "Fractal Monism corpus",
    description: "Controls how much the current Fractal Monism knowledge base is used.",
    category: "retrieval",
    audience: "user",
    status: "stable",
    risk: "low",
    currentField: "mix.corpus",
  },
  {
    key: "lens_fm",
    label: "Fractal Monism lens",
    description: "Adds a Fractal Monism framing constraint to the answer without changing retrieval.",
    category: "lens",
    audience: "user",
    status: "stable",
    risk: "low",
    currentField: "mix.lens_fm",
  },
  {
    key: "similarity_threshold",
    label: "Context match strictness",
    description: "Controls how strict retrieval matching should be before context is used.",
    category: "retrieval",
    audience: "admin",
    status: "experimental",
    risk: "medium",
    currentField: "mix.similarity_threshold",
  },
  {
    key: "recency_bias",
    label: "Prefer recent context",
    description: "Reranks retrieval toward newer items without acting as a hard filter.",
    category: "retrieval",
    audience: "admin",
    status: "experimental",
    risk: "medium",
    currentField: "mix.recency_bias",
  },
  {
    key: "answer_first",
    label: "Answer directly by default",
    description: "Prefers direct answers rather than asking clarifying questions first.",
    category: "routing",
    audience: "user",
    status: "stable",
    risk: "low",
    currentField: "routing.answer_first",
  },
  {
    key: "clarify_bias",
    label: "Ask-questions tendency",
    description: "Controls tendency to ask clarifying questions when the goal is unclear.",
    category: "routing",
    audience: "user",
    status: "stable",
    risk: "low",
    currentField: "routing.clarify_bias",
  },
  {
    key: "max_clarify_questions",
    label: "Question limit before answering",
    description: "Caps how many clarifying questions can be asked before answering.",
    category: "routing",
    audience: "user",
    status: "stable",
    risk: "low",
    currentField: "routing.max_clarify_questions",
  },
  {
    key: "rfg",
    label: "Conversational opening",
    description: "Controls whether social openings stay relational or move quickly into task framing.",
    category: "social",
    audience: "admin",
    status: "stable",
    risk: "medium",
    currentField: "pragmatics.rfg",
  },
  {
    key: "df",
    label: "AI disclaimer restraint",
    description: "Controls how much the assistant avoids volunteering AI/meta disclaimers unless asked.",
    category: "social",
    audience: "admin",
    status: "experimental",
    risk: "medium",
    currentField: "pragmatics.df",
  },
  {
    key: "pe",
    label: "Persona intensity",
    description: "Controls how strongly the active Vantage persona affects verbal style.",
    category: "social",
    audience: "admin",
    status: "stable",
    risk: "medium",
    currentField: "pragmatics.pe",
  },
  {
    key: "Y",
    label: "Agreeability under pressure",
    description: "Higher values concede/defer more under pressure; lower values hold firmer.",
    category: "limiters",
    audience: "admin",
    status: "stable",
    risk: "high",
    currentField: "limits.Y",
  },
  {
    key: "R",
    label: "Evidence-based revision",
    description: "Controls how readily the assistant revises when new evidence appears.",
    category: "limiters",
    audience: "admin",
    status: "stable",
    risk: "medium",
    currentField: "limits.R",
  },
  {
    key: "C",
    label: "Adaptation strength",
    description: "Experimental coupling value intended to control behavioral shaping from feedback. Currently partially wired and should remain admin-only until verified.",
    category: "limiters",
    audience: "admin",
    status: "experimental",
    risk: "high",
    currentField: "limits.C",
  },
  {
    key: "S",
    label: "Extra wording",
    description: "Controls verbosity, hedges, affirmations, compliments, and decorative phrasing.",
    category: "limiters",
    audience: "admin",
    status: "stable",
    risk: "medium",
    currentField: "limits.S",
  },

  // Planned future controls. These are not rendered yet.
  {
    key: "response_length",
    label: "Response length",
    description: "Future user-facing control for brief, balanced, or detailed answers.",
    category: "future",
    audience: "user",
    status: "future",
    risk: "low",
  },
  {
    key: "social_warmth",
    label: "Social warmth",
    description: "Future user-facing control for minimal, natural, or warm social tone.",
    category: "future",
    audience: "user",
    status: "future",
    risk: "low",
  },
  {
    key: "decorative_language",
    label: "Decorative language",
    description: "Future user-facing control for plain, expressive, or stylized language.",
    category: "future",
    audience: "user",
    status: "future",
    risk: "low",
  },
  {
    key: "initiative",
    label: "Initiative",
    description: "Future control for whether the assistant waits, suggests next steps, or actively guides workflow.",
    category: "future",
    audience: "user",
    status: "future",
    risk: "medium",
  },
  {
    key: "correction_style",
    label: "Correction style",
    description: "Future control for gentle, direct, or strict correction.",
    category: "future",
    audience: "user",
    status: "future",
    risk: "medium",
  },
  {
    key: "process_discipline",
    label: "Process discipline",
    description: "Future control for conversational, careful, or strict verification behavior.",
    category: "future",
    audience: "user",
    status: "future",
    risk: "medium",
  },
  {
    key: "memory_scope",
    label: "Memory scope",
    description: "Future control for none, project-only, user preferences, personal history, or broad memory.",
    category: "future",
    audience: "user",
    status: "future",
    risk: "high",
  },
  {
    key: "context_relevance_discipline",
    label: "Context relevance discipline",
    description: "Future control to prevent unrelated prior context from being pulled in just because it exists.",
    category: "future",
    audience: "admin",
    status: "future",
    risk: "medium",
  },
];
