"use client";

import * as React from "react";

export type JsonObject = Record<string, unknown>;

export type PlanDocument = {
  schema_version: number;
  phase: string;
  phase_label: string;
  primary_goal: string;
  start_date: string | null;
  review_date: string | null;
  review_cadence: string;
  body_state: JsonObject;
  nutrition_targets: JsonObject;
  training_targets: JsonObject;
  conditioning_targets: JsonObject;
  activity_targets: JsonObject;
  recovery_targets: JsonObject;
  monitoring_rules: JsonObject;
  coach_notes: string;
};

type SectionKey =
  | "body_state"
  | "nutrition_targets"
  | "training_targets"
  | "conditioning_targets"
  | "activity_targets"
  | "recovery_targets"
  | "monitoring_rules";

type GuideStepId =
  | "direction"
  | "goal"
  | "schedule"
  | SectionKey
  | "coach_notes"
  | "review";

type PlanDraftWorkspaceProps = {
  revisionId: string;
  document: PlanDocument;
  saving: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (document: PlanDocument) => Promise<boolean>;
};

const SECTIONS: Array<{
  key: SectionKey;
  label: string;
  prompt: string;
}> = [
  {
    key: "body_state",
    label: "Current body state",
    prompt: "What measurements describe the starting point for this phase?",
  },
  {
    key: "nutrition_targets",
    label: "Nutrition targets",
    prompt: "What intake range and adherence targets support the goal?",
  },
  {
    key: "training_targets",
    label: "Strength training targets",
    prompt: "What training schedule and progression rules should be preserved?",
  },
  {
    key: "conditioning_targets",
    label: "Conditioning targets",
    prompt: "What conditioning dose, intensity, and mode fit the phase?",
  },
  {
    key: "activity_targets",
    label: "Daily activity targets",
    prompt: "What daily movement target should be monitored?",
  },
  {
    key: "recovery_targets",
    label: "Sleep and recovery",
    prompt: "What recovery expectations or warning signs matter?",
  },
  {
    key: "monitoring_rules",
    label: "Monitoring and adjustment rules",
    prompt: "What evidence should trigger continuation, review, or a change?",
  },
];

const GUIDE_STEPS: Array<{ id: GuideStepId; label: string }> = [
  { id: "direction", label: "Direction" },
  { id: "goal", label: "Goal" },
  { id: "schedule", label: "Schedule" },
  ...SECTIONS.map((section) => ({ id: section.key, label: section.label })),
  { id: "coach_notes", label: "Notes" },
  { id: "review", label: "Review" },
];

const PHASES = [
  ["cut", "Cut"],
  ["maintenance", "Maintenance"],
  ["lean_gain", "Lean gain"],
  ["recomp", "Recomposition"],
  ["other", "Other"],
] as const;

function cloneDocument(document: PlanDocument): PlanDocument {
  return JSON.parse(JSON.stringify(document)) as PlanDocument;
}

function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.some(isMeaningful);
  if (isPlainObject(value)) return Object.values(value).some(isMeaningful);
  return true;
}

function leafCounts(value: unknown): { filled: number; total: number } {
  if (isPlainObject(value)) {
    const entries = Object.values(value);
    if (!entries.length) return { filled: 0, total: 0 };
    return entries.reduce<{ filled: number; total: number }>(
      (sum, item) => {
        const next = leafCounts(item);
        return {
          filled: sum.filled + next.filled,
          total: sum.total + next.total,
        };
      },
      { filled: 0, total: 0 },
    );
  }
  if (Array.isArray(value)) {
    if (!value.length) return { filled: 0, total: 1 };
    return value.reduce<{ filled: number; total: number }>(
      (sum, item) => {
        const next = leafCounts(item);
        return {
          filled: sum.filled + next.filled,
          total: sum.total + next.total,
        };
      },
      { filled: 0, total: 0 },
    );
  }
  return { filled: isMeaningful(value) ? 1 : 0, total: 1 };
}

function progressLabel(value: unknown): string {
  const counts = leafCounts(value);
  if (!counts.total || !counts.filled) return "Needs information";
  if (counts.filled < counts.total) return "In progress";
  return "Complete";
}

function updateNestedValue(
  value: JsonObject,
  path: string[],
  nextValue: unknown,
): JsonObject {
  const copy = JSON.parse(JSON.stringify(value)) as JsonObject;
  let current = copy;
  path.slice(0, -1).forEach((part) => {
    const existing = current[part];
    if (!isPlainObject(existing)) current[part] = {};
    current = current[part] as JsonObject;
  });
  current[path[path.length - 1]] = nextValue;
  return copy;
}

function PrimitiveField({
  fieldKey,
  value,
  onChange,
}: {
  fieldKey: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = humanize(fieldKey);
  const id = React.useId();
  if (typeof value === "boolean") {
    return (
      <label
        htmlFor={id}
        className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"
      >
        <span className="font-medium">{label}</span>
        <input
          id={id}
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(event.target.checked)}
          className="size-5"
        />
      </label>
    );
  }

  if (typeof value === "number") {
    return (
      <label htmlFor={id} className="grid gap-1.5 text-sm">
        <span className="font-medium">{label}</span>
        <input
          id={id}
          type="number"
          value={Number.isFinite(value) ? value : ""}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? "" : Number(event.target.value),
            )
          }
          className="rounded-xl border bg-background px-3 py-2.5"
        />
      </label>
    );
  }

  if (Array.isArray(value)) {
    return (
      <label htmlFor={id} className="grid gap-1.5 text-sm">
        <span className="font-medium">{label}</span>
        <textarea
          id={id}
          value={value.map(String).join("\n")}
          onChange={(event) =>
            onChange(
              event.target.value
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
          rows={3}
          className="rounded-xl border bg-background px-3 py-2.5"
        />
      </label>
    );
  }

  const stringValue =
    value === null || value === undefined ? "" : String(value);
  const useTextarea =
    stringValue.length > 60 ||
    /(notes|rule|summary|goal|constraints|structure|priority)/i.test(fieldKey);
  return (
    <label htmlFor={id} className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {useTextarea ? (
        <textarea
          id={id}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="rounded-xl border bg-background px-3 py-2.5"
        />
      ) : (
        <input
          id={id}
          type="text"
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-xl border bg-background px-3 py-2.5"
        />
      )}
    </label>
  );
}

function ObjectFields({
  value,
  onChange,
  path = [],
}: {
  value: JsonObject;
  onChange: (path: string[], value: unknown) => void;
  path?: string[];
}) {
  const entries = Object.entries(value);
  if (!entries.length) {
    return (
      <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
        No fields are defined in this section yet.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      {entries.map(([key, item]) => {
        if (isPlainObject(item)) {
          return (
            <fieldset key={key} className="grid gap-3 rounded-xl border p-3">
              <legend className="px-1 text-sm font-semibold">
                {humanize(key)}
              </legend>
              <ObjectFields
                value={item}
                path={[...path, key]}
                onChange={onChange}
              />
            </fieldset>
          );
        }
        return (
          <PrimitiveField
            key={key}
            fieldKey={key}
            value={item}
            onChange={(nextValue) => onChange([...path, key], nextValue)}
          />
        );
      })}
    </div>
  );
}

function ProgressBadge({ value }: { value: unknown }) {
  const label = progressLabel(value);
  return (
    <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      {label}
    </span>
  );
}

export function PlanDraftWorkspace({
  revisionId,
  document,
  saving,
  onDirtyChange,
  onSave,
}: PlanDraftWorkspaceProps) {
  const [draft, setDraft] = React.useState<PlanDocument>(() =>
    cloneDocument(document),
  );
  const [baseline, setBaseline] = React.useState(() =>
    JSON.stringify(document),
  );
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);

  React.useEffect(() => {
    setDraft(cloneDocument(document));
    setBaseline(JSON.stringify(document));
    setGuideOpen(false);
    setStepIndex(0);
  }, [document, revisionId]);

  const serializedDraft = JSON.stringify(draft);
  const dirty = serializedDraft !== baseline;

  React.useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  function openStep(step: GuideStepId) {
    const index = GUIDE_STEPS.findIndex((item) => item.id === step);
    setStepIndex(Math.max(index, 0));
    setGuideOpen(true);
  }

  function updateSection(section: SectionKey, path: string[], value: unknown) {
    setDraft((current) => ({
      ...current,
      [section]: updateNestedValue(current[section], path, value),
    }));
  }

  async function saveDraft(closeAfterSave: boolean) {
    if (!dirty) {
      if (closeAfterSave) setGuideOpen(false);
      return;
    }
    const saved = await onSave(draft);
    if (!saved) return;
    setBaseline(serializedDraft);
    if (closeAfterSave) setGuideOpen(false);
  }

  const step = GUIDE_STEPS[stepIndex];
  const section = SECTIONS.find((item) => item.key === step?.id);

  return (
    <div
      className="grid gap-4 rounded-2xl border bg-muted/20 p-3 sm:p-4"
      data-testid="plan-draft-workspace"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Inactive draft workspace
          </div>
          <h2 className="mt-1 text-lg font-semibold">
            Build the next Plan version
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Work section by section. Saving updates only this draft; the active
            Plan remains unchanged until owner approval.
          </p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-medium">
          {dirty ? "Unsaved changes" : "Draft saved"}
        </span>
      </div>

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={() => openStep("direction")}
          className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          Guide me through the Plan
        </button>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void saveDraft(false)}
          className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save draft"}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => openStep("direction")}
          className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 text-left"
        >
          <span>
            <span className="block text-sm font-semibold">
              Direction and goal
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {draft.phase_label || humanize(draft.phase)}
            </span>
          </span>
          <ProgressBadge
            value={[draft.phase, draft.phase_label, draft.primary_goal]}
          />
        </button>
        <button
          type="button"
          onClick={() => openStep("schedule")}
          className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 text-left"
        >
          <span>
            <span className="block text-sm font-semibold">
              Schedule and review
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {draft.review_date
                ? `Review ${draft.review_date}`
                : "No review date"}
            </span>
          </span>
          <ProgressBadge
            value={[draft.start_date, draft.review_date, draft.review_cadence]}
          />
        </button>
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => openStep(item.key)}
            className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 text-left"
          >
            <span className="text-sm font-semibold">{item.label}</span>
            <ProgressBadge value={draft[item.key]} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => openStep("coach_notes")}
          className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 text-left"
        >
          <span className="text-sm font-semibold">Coach notes</span>
          {draft.coach_notes ? (
            <ProgressBadge value={draft.coach_notes} />
          ) : (
            <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Optional
            </span>
          )}
        </button>
      </div>

      {guideOpen ? (
        <div
          className="fixed inset-0 z-[80] overflow-y-auto bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="Guided Plan setup"
        >
          <div className="mx-auto flex min-h-full max-w-3xl flex-col">
            <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Guided Plan setup
                  </div>
                  <div className="text-sm font-semibold">
                    Step {stepIndex + 1} of {GUIDE_STEPS.length}: {step.label}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGuideOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Close
                </button>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${((stepIndex + 1) / GUIDE_STEPS.length) * 100}%`,
                  }}
                />
              </div>
            </header>

            <main className="flex-1 px-4 py-6">
              {step.id === "direction" ? (
                <div className="grid gap-4">
                  <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    This first guided slice organizes and saves the inactive
                    draft. Sage-generated recommendations will be connected to
                    this same workspace next; nothing in this guide is
                    model-generated yet.
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">
                      What direction is this Plan taking?
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose the phase and give it a plain-language name.
                    </p>
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Phase</span>
                    <select
                      value={draft.phase}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          phase: event.target.value,
                        }))
                      }
                      className="rounded-xl border bg-background px-3 py-3"
                    >
                      {PHASES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Phase name</span>
                    <input
                      value={draft.phase_label}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          phase_label: event.target.value,
                        }))
                      }
                      className="rounded-xl border bg-background px-3 py-3"
                    />
                  </label>
                </div>
              ) : null}

              {step.id === "goal" ? (
                <div className="grid gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">
                      What should this phase accomplish?
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Describe the outcome clearly enough to guide nutrition,
                      training, and measurement decisions.
                    </p>
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Primary goal</span>
                    <textarea
                      value={draft.primary_goal}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          primary_goal: event.target.value,
                        }))
                      }
                      rows={6}
                      className="rounded-xl border bg-background px-3 py-3"
                    />
                  </label>
                </div>
              ) : null}

              {step.id === "schedule" ? (
                <div className="grid gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">
                      When will the Plan be reviewed?
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A review date creates a boundary for collecting enough
                      observations before changing course.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Start date</span>
                      <input
                        type="date"
                        value={draft.start_date || ""}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            start_date: event.target.value || null,
                          }))
                        }
                        className="rounded-xl border bg-background px-3 py-3"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">Next review</span>
                      <input
                        type="date"
                        value={draft.review_date || ""}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            review_date: event.target.value || null,
                          }))
                        }
                        className="rounded-xl border bg-background px-3 py-3"
                      />
                    </label>
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Review cadence</span>
                    <input
                      value={draft.review_cadence}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          review_cadence: event.target.value,
                        }))
                      }
                      className="rounded-xl border bg-background px-3 py-3"
                    />
                  </label>
                </div>
              ) : null}

              {section ? (
                <div className="grid gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">{section.label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {section.prompt}
                    </p>
                  </div>
                  <ObjectFields
                    value={draft[section.key]}
                    onChange={(path, value) =>
                      updateSection(section.key, path, value)
                    }
                  />
                </div>
              ) : null}

              {step.id === "coach_notes" ? (
                <div className="grid gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Notes and context</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Record constraints, preferences, or coaching context that
                      should remain attached to the Plan.
                    </p>
                  </div>
                  <textarea
                    value={draft.coach_notes}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        coach_notes: event.target.value,
                      }))
                    }
                    rows={8}
                    className="rounded-xl border bg-background px-3 py-3"
                    aria-label="Coach notes"
                  />
                </div>
              ) : null}

              {step.id === "review" ? (
                <div className="grid gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Review the draft</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Save this draft before returning to the change-review and
                      approval workflow.
                    </p>
                  </div>
                  <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Phase
                      </dt>
                      <dd className="mt-1 text-sm font-semibold">
                        {draft.phase_label || humanize(draft.phase)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Review
                      </dt>
                      <dd className="mt-1 text-sm">
                        {draft.review_date || "Not set"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium text-muted-foreground">
                        Primary goal
                      </dt>
                      <dd className="mt-1 text-sm whitespace-pre-wrap">
                        {draft.primary_goal || "Not set"}
                      </dd>
                    </div>
                  </dl>
                  <div className="grid gap-2 sm:flex">
                    <button
                      type="button"
                      disabled={!dirty || saving}
                      onClick={() => void saveDraft(true)}
                      className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {saving
                        ? "Saving…"
                        : dirty
                          ? "Save draft and close"
                          : "Draft already saved"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStepIndex(0)}
                      className="rounded-xl border px-4 py-3 text-sm font-semibold"
                    >
                      Review again
                    </button>
                  </div>
                </div>
              ) : null}
            </main>

            <footer className="sticky bottom-0 border-t bg-background/95 px-4 py-3 backdrop-blur">
              <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={stepIndex === 0}
                  onClick={() =>
                    setStepIndex((current) => Math.max(0, current - 1))
                  }
                  className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-40"
                >
                  Back
                </button>
                {stepIndex < GUIDE_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setStepIndex((current) =>
                        Math.min(GUIDE_STEPS.length - 1, current + 1),
                      )
                    }
                    className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                  >
                    Continue
                  </button>
                ) : null}
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
