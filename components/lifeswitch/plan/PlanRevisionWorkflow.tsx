"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import {
  PlanDraftWorkspace,
  type JsonObject,
  type PlanDocument,
  type SagePlanReview,
  type SageReviewFocus,
} from "@/components/lifeswitch/plan/PlanDraftWorkspace";
import { authFetch } from "@/lib/authFetch";

type ValidationIssue = {
  code: string;
  field_path: string;
  severity: "error" | "warning" | string;
  message: string;
};

type RevisionChange = {
  field_path: string;
  old_present: boolean;
  old_value: unknown;
  new_present: boolean;
  new_value: unknown;
  rationale: string | null;
};

type Revision = {
  revision_id: string;
  state: string;
  base_plan_version_id: string | null;
  base_is_current: boolean;
  proposed_document: PlanDocument;
  validation_result: {
    status: string;
    issues: ValidationIssue[];
  } | null;
  changes: RevisionChange[];
  proposed_at: string | null;
  source: {
    source_kind?: string;
    source_action?: string;
    legacy_plan_profile_id?: string;
    legacy_profile_updated_at?: string;
  } | null;
  can_approve: boolean;
};

type ActivePlan = {
  plan_version_id: string;
  version_number: number;
  status: string;
  document: PlanDocument;
  activated_at: string;
};

type Workspace = {
  active_plan: ActivePlan | null;
  open_revision: Revision | null;
  capabilities?: {
    can_edit?: boolean;
    can_approve?: boolean;
  };
};

const SECTION_LABELS: Array<[keyof PlanDocument, string]> = [
  ["body_state", "Current body state"],
  ["nutrition_targets", "Nutrition targets"],
  ["training_targets", "Strength training targets"],
  ["conditioning_targets", "Conditioning targets"],
  ["activity_targets", "Daily activity targets"],
  ["recovery_targets", "Sleep and recovery"],
  ["monitoring_rules", "Monitoring and adjustment rules"],
];

function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFieldPath(value: string): string {
  return value
    .split("/")
    .filter(Boolean)
    .map((part) => humanize(part.replaceAll("~1", "/").replaceAll("~0", "~")))
    .join(" › ");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as JsonObject)
      .map(([key, item]) => `${humanize(key)}: ${formatValue(item)}`)
      .join(" · ");
  }
  return String(value);
}

function friendlyError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object") {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return `Plan request failed (HTTP ${status}).`;
}

function LinkedWorkoutPlanSummary({ value }: { value: unknown }) {
  const entries = Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
  if (!entries.length) return null;
  return (
    <div className="grid gap-2 sm:col-span-2">
      <div className="text-xs font-medium text-muted-foreground">
        Linked workout schedule
      </div>
      {entries.map((entry, index) => {
        const snapshot =
          entry.prescription_snapshot &&
          typeof entry.prescription_snapshot === "object" &&
          !Array.isArray(entry.prescription_snapshot)
            ? (entry.prescription_snapshot as JsonObject)
            : {};
        const exercises = Array.isArray(snapshot.exercises)
          ? snapshot.exercises.filter(
              (item): item is JsonObject =>
                Boolean(item) &&
                typeof item === "object" &&
                !Array.isArray(item),
            )
          : [];
        const role = String(snapshot.role || "strength");
        return (
          <article
            key={String(entry.workout_template_id || index)}
            className="rounded-xl bg-muted/35 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">
                  {String(snapshot.name || "Saved workout")}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {Number(entry.sessions_per_week || 0)} session(s)/week ·{" "}
                  {humanize(role)}
                  {role === "rehab" ? " · excluded from strength totals" : ""}
                </div>
              </div>
              <span className="rounded-full border px-2 py-1 text-[11px] text-muted-foreground">
                Pinned prescription
              </span>
            </div>
            {entry.schedule_notes ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {String(entry.schedule_notes)}
              </p>
            ) : null}
            {exercises.length ? (
              <details className="mt-2 rounded-lg border bg-background">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
                  View {exercises.length} prescribed exercises
                </summary>
                <div className="grid gap-1.5 border-t p-3 text-xs">
                  {exercises.map((exercise, exerciseIndex) => (
                    <div
                      key={`${String(exercise.name || "exercise")}:${exerciseIndex}`}
                    >
                      <span className="font-medium">
                        {String(exercise.name || "Exercise")}
                      </span>
                      <span className="text-muted-foreground">
                        {` · ${Number(exercise.planned_sets || 0)} sets`}
                        {Number(exercise.default_reps || 0)
                          ? ` · ${Number(exercise.default_reps)} reps`
                          : ""}
                        {Number(exercise.default_weight || 0)
                          ? ` · ${Number(exercise.default_weight)} lb`
                          : ""}
                        {exercise.role === "rehab" ? " · Rehab" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function LinkedConditioningPlanSummary({ value }: { value: unknown }) {
  const entries = Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
  if (!entries.length) return null;
  return (
    <div className="grid gap-2 sm:col-span-2">
      <div className="text-xs font-medium text-muted-foreground">
        Linked conditioning schedule
      </div>
      {entries.map((entry, index) => {
        const snapshot =
          entry.prescription_snapshot &&
          typeof entry.prescription_snapshot === "object" &&
          !Array.isArray(entry.prescription_snapshot)
            ? (entry.prescription_snapshot as JsonObject)
            : {};
        const doseConfig =
          snapshot.dose_config &&
          typeof snapshot.dose_config === "object" &&
          !Array.isArray(snapshot.dose_config)
            ? (snapshot.dose_config as JsonObject)
            : {};
        const facts = [
          snapshot.target_duration_min
            ? `${Number(snapshot.target_duration_min)} min`
            : null,
          snapshot.modality ? humanize(String(snapshot.modality)) : null,
          snapshot.target_intensity
            ? humanize(String(snapshot.target_intensity))
            : null,
        ].filter(Boolean);
        return (
          <article
            key={String(entry.my_conditioning_prescription_id || index)}
            className="rounded-xl bg-muted/35 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">
                  {String(snapshot.name || "Saved conditioning plan")}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {Number(entry.sessions_per_week || 0)} session(s)/week
                  {facts.length ? ` · ${facts.join(" · ")}` : ""}
                </div>
              </div>
              <span className="rounded-full border px-2 py-1 text-[11px] text-muted-foreground">
                Pinned prescription
              </span>
            </div>
            {entry.schedule_notes ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {String(entry.schedule_notes)}
              </p>
            ) : null}
            <details className="mt-2 rounded-lg border bg-background">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
                View prescribed dose
              </summary>
              <dl className="grid gap-2 border-t p-3 text-xs sm:grid-cols-2">
                {[
                  ["Purpose", snapshot.purpose],
                  ["Preferred timing", snapshot.preferred_timing],
                  ["Dose type", snapshot.dose_type],
                  ["Dose", doseConfig],
                  ["Recovery constraints", snapshot.recovery_constraints],
                  ["Notes", snapshot.notes],
                ].map(([label, item]) =>
                  item &&
                  (typeof item !== "object" || Object.keys(item).length) ? (
                    <div key={String(label)}>
                      <dt className="font-medium text-muted-foreground">
                        {String(label)}
                      </dt>
                      <dd className="mt-0.5 break-words">
                        {formatValue(item)}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </details>
          </article>
        );
      })}
    </div>
  );
}

function PlanFieldList({
  entries,
  className = "",
}: {
  entries: Array<[string, unknown]>;
  className?: string;
}) {
  return (
    <dl className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="text-xs font-medium text-muted-foreground">
            {humanize(key)}
          </dt>
          <dd className="mt-1 text-sm break-words">{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function PlanSummary({
  document,
  title = "Plan overview",
}: {
  document: PlanDocument;
  title?: string;
}) {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(),
  );
  const sectionKeys = [
    "overview",
    ...SECTION_LABELS.map(([field]) => String(field)),
  ];
  if (document.coach_notes) sectionKeys.push("coach_notes");

  function toggleSection(section: string) {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="flex gap-2">
          <button
            className="rounded-lg border px-3 py-2 text-xs font-medium"
            type="button"
            onClick={() => setExpandedSections(new Set(sectionKeys))}
          >
            Expand all
          </button>
          <button
            className="rounded-lg border px-3 py-2 text-xs font-medium"
            type="button"
            onClick={() => setExpandedSections(new Set())}
          >
            Collapse all
          </button>
        </div>
      </div>
      <section className="rounded-xl border bg-background">
        <button
          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm font-medium"
          type="button"
          aria-expanded={expandedSections.has("overview")}
          onClick={() => toggleSection("overview")}
        >
          <span>Plan overview</span>
          <span
            aria-hidden="true"
            className={`text-xl leading-none transition-transform ${
              expandedSections.has("overview") ? "rotate-90" : ""
            }`}
          >
            ›
          </span>
        </button>
        {expandedSections.has("overview") ? (
          <dl className="grid gap-3 border-t bg-muted/40 p-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Current phase
              </dt>
              <dd className="mt-1 text-sm font-semibold">
                {document.phase_label || humanize(document.phase)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Review cadence
              </dt>
              <dd className="mt-1 text-sm">
                {humanize(document.review_cadence)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">
                Primary goal
              </dt>
              <dd className="mt-1 text-sm whitespace-pre-wrap">
                {document.primary_goal || "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Start date
              </dt>
              <dd className="mt-1 text-sm">
                {document.start_date || "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Next Plan check-in
              </dt>
              <dd className="mt-1 text-sm">
                {document.review_date || "Not set"}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      {SECTION_LABELS.map(([field, label]) => {
        const values = document[field] as JsonObject;
        const linkedWorkouts =
          field === "training_targets" ? values?.linked_workouts : null;
        const linkedConditioning =
          field === "conditioning_targets" ? values?.linked_conditioning : null;
        const entries = Object.entries(values || {}).filter(
          ([key]) => key !== "linked_workouts" && key !== "linked_conditioning",
        );
        const hasLinkedWorkouts =
          Array.isArray(linkedWorkouts) && linkedWorkouts.length > 0;
        const hasLinkedConditioning =
          Array.isArray(linkedConditioning) && linkedConditioning.length > 0;
        const hasPinnedPrescription =
          hasLinkedWorkouts || hasLinkedConditioning;
        const additionalLabel = hasLinkedWorkouts
          ? "Additional strength guidance"
          : hasLinkedConditioning
            ? "Additional conditioning guidance"
            : "Additional guidance";
        const expanded = expandedSections.has(String(field));
        return (
          <section key={field} className="rounded-xl border bg-background">
            <button
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm font-medium"
              type="button"
              aria-expanded={expanded}
              onClick={() => toggleSection(String(field))}
            >
              <span>{label}</span>
              <span aria-hidden="true" className="text-lg leading-none">
                {expanded ? "−" : "+"}
              </span>
            </button>
            {expanded ? (
              <div className="grid gap-3 border-t px-3 py-3 sm:grid-cols-2">
                {field === "training_targets" ? (
                  <LinkedWorkoutPlanSummary value={linkedWorkouts} />
                ) : null}
                {field === "conditioning_targets" ? (
                  <LinkedConditioningPlanSummary value={linkedConditioning} />
                ) : null}
                {entries.length && hasPinnedPrescription ? (
                  <details className="rounded-xl border bg-muted/20 sm:col-span-2">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
                      {additionalLabel}
                    </summary>
                    <PlanFieldList entries={entries} className="border-t p-3" />
                  </details>
                ) : entries.length ? (
                  <PlanFieldList entries={entries} className="sm:col-span-2" />
                ) : !hasPinnedPrescription ? (
                  <div className="text-sm text-muted-foreground">
                    No targets defined.
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}

      {document.coach_notes ? (
        <section className="rounded-xl border bg-background">
          <button
            className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm font-medium"
            type="button"
            aria-expanded={expandedSections.has("coach_notes")}
            onClick={() => toggleSection("coach_notes")}
          >
            <span>Notes and context</span>
            <span aria-hidden="true" className="text-lg leading-none">
              {expandedSections.has("coach_notes") ? "−" : "+"}
            </span>
          </button>
          {expandedSections.has("coach_notes") ? (
            <p className="border-t px-3 py-3 text-sm whitespace-pre-wrap">
              {document.coach_notes}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ValidationSummary({ revision }: { revision: Revision }) {
  const issues = revision.validation_result?.issues || [];
  if (!revision.validation_result) return null;
  return (
    <div className="rounded-xl border p-3">
      <div className="text-sm font-medium">
        Review status: {humanize(revision.validation_result.status)}
      </div>
      {issues.length ? (
        <ul className="mt-2 grid gap-2 text-sm">
          {issues.map((issue) => (
            <li key={`${issue.code}:${issue.field_path}`}>
              <span
                className={
                  issue.severity === "error"
                    ? "font-medium text-destructive"
                    : "font-medium"
                }
              >
                {humanize(issue.severity)}:
              </span>{" "}
              {issue.message}
              <span className="text-muted-foreground">
                {" "}
                ({humanize(issue.field_path)})
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          No validation issues found.
        </p>
      )}
    </div>
  );
}

function ChangeSummary({ changes }: { changes: RevisionChange[] }) {
  if (!changes.length) return null;
  return (
    <details className="rounded-xl border bg-background">
      <summary className="cursor-pointer px-3 py-3 text-sm font-medium">
        Changes in this revision ({changes.length})
      </summary>
      <div className="grid gap-3 border-t px-3 py-3">
        {changes.map((change) => (
          <div
            key={change.field_path}
            className="grid gap-1 text-sm sm:grid-cols-[12rem_1fr]"
          >
            <div className="font-medium">
              {formatFieldPath(change.field_path)}
            </div>
            <div>
              <span className="text-muted-foreground">
                {change.old_present
                  ? formatValue(change.old_value)
                  : "Not previously set"}
              </span>
              <span aria-hidden="true"> → </span>
              <span>
                {change.new_present ? formatValue(change.new_value) : "Removed"}
              </span>
              {change.rationale ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {change.rationale}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export function PlanRevisionWorkflow() {
  const searchParams = useSearchParams();
  const targetUserId = String(searchParams.get("target_user_id") || "").trim();
  const delegated = Boolean(targetUserId);
  const [workspace, setWorkspace] = React.useState<Workspace | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [pendingAction, setPendingAction] = React.useState("");
  const [draftHasUnsavedChanges, setDraftHasUnsavedChanges] =
    React.useState(false);
  const [draftEditorOpen, setDraftEditorOpen] = React.useState(false);
  const [planView, setPlanView] = React.useState<"active" | "draft">("active");
  const idempotencyKeys = React.useRef<Record<string, string>>({});

  const apiUrl = React.useCallback(
    (path: string) => {
      const url = new URL(
        `/api/lifeswitch/plan/agentic/${path}`,
        window.location.origin,
      );
      if (targetUserId) url.searchParams.set("target_user_id", targetUserId);
      return url.toString();
    },
    [targetUserId],
  );

  const loadWorkspace = React.useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const response = await authFetch(apiUrl("workspace"), {
        cache: "no-store",
        headers: {
          "x-lifeswitch-owner-timezone":
            Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        },
      });
      const text = await response.text();
      const payload: unknown = text ? JSON.parse(text) : null;
      if (!response.ok)
        throw new Error(friendlyError(payload, response.status));
      setWorkspace(payload as Workspace);
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("error");
    }
  }, [apiUrl]);

  React.useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  React.useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  async function runAction(
    path: string,
    actionKey: string,
    successMessage: string,
    body?: Record<string, unknown>,
    method: "POST" | "PUT" = "POST",
  ): Promise<boolean> {
    setPendingAction(actionKey);
    setError("");
    setMessage("");
    const key = idempotencyKeys.current[actionKey] || crypto.randomUUID();
    idempotencyKeys.current[actionKey] = key;
    try {
      const response = await authFetch(apiUrl(path), {
        method,
        cache: "no-store",
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          "idempotency-key": key,
          ...(body ? { "content-type": "application/json" } : {}),
          "x-lifeswitch-owner-timezone":
            Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        },
      });
      const text = await response.text();
      const payload: unknown = text ? JSON.parse(text) : null;
      if (!response.ok)
        throw new Error(friendlyError(payload, response.status));
      delete idempotencyKeys.current[actionKey];
      setMessage(successMessage);
      await loadWorkspace();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return false;
    } finally {
      setPendingAction("");
    }
  }

  async function requestSageReview(request: {
    focus: SageReviewFocus;
    user_request: string;
  }): Promise<SagePlanReview> {
    const currentRevision = workspace?.open_revision;
    if (!currentRevision || currentRevision.state !== "draft") {
      throw new Error("Sage can review only an inactive draft.");
    }
    const response = await authFetch(
      apiUrl(`revisions/${currentRevision.revision_id}/recommendations`),
      {
        method: "POST",
        cache: "no-store",
        body: JSON.stringify(request),
        headers: {
          "content-type": "application/json",
          "x-lifeswitch-owner-timezone":
            Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        },
      },
    );
    const text = await response.text();
    const payload: unknown = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error(friendlyError(payload, response.status));
    if (!payload || typeof payload !== "object") {
      throw new Error("Sage returned an invalid Plan review.");
    }
    const recommendation = (payload as { recommendation?: unknown })
      .recommendation;
    if (!recommendation || typeof recommendation !== "object") {
      throw new Error("Sage returned an invalid Plan review.");
    }
    return recommendation as SagePlanReview;
  }

  const revision = workspace?.open_revision || null;
  const activePlan = workspace?.active_plan || null;
  const canEdit = workspace?.capabilities?.can_edit ?? !delegated;
  const viewingDraft = Boolean(
    revision && (planView === "draft" || !activePlan || draftEditorOpen),
  );
  const headerDocument =
    viewingDraft && revision
      ? revision.proposed_document
      : activePlan?.document || revision?.proposed_document || null;

  React.useEffect(() => {
    setDraftEditorOpen(false);
    setPlanView(activePlan ? "active" : "draft");
  }, [activePlan?.plan_version_id, revision?.revision_id]);

  return (
    <section className="mx-auto grid max-w-6xl gap-4 px-4 pt-4 md:px-6 md:pt-6">
      <div className="rounded-2xl border bg-background p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              LifeSwitch Plan
            </div>
            <h1 className="mt-1 text-xl font-semibold">
              {headerDocument?.phase_label || "Your Plan"}
            </h1>
            {viewingDraft && revision ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Draft based on active version{" "}
                {activePlan?.version_number ?? "—"}
              </p>
            ) : activePlan ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Active version {activePlan.version_number}
                {headerDocument?.review_date
                  ? ` · Next check-in ${headerDocument.review_date}`
                  : ""}
              </p>
            ) : revision ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Saved draft · Not active
              </p>
            ) : null}
          </div>
          {viewingDraft && revision ? (
            <span className="rounded-full border px-3 py-1 text-xs font-medium">
              {humanize(revision.state)}
            </span>
          ) : activePlan ? (
            <span className="rounded-full border px-3 py-1 text-xs font-medium">
              Active version {activePlan.version_number}
            </span>
          ) : (
            <span className="rounded-full border px-3 py-1 text-xs font-medium">
              Not prepared
            </span>
          )}
        </div>

        {status === "loading" ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Loading plan workflow…
          </p>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-destructive/40 p-3 text-sm"
          >
            {error}
            {status === "error" ? (
              <button
                className="ml-2 underline"
                type="button"
                onClick={() => void loadWorkspace()}
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 rounded-xl border p-3 text-sm">{message}</div>
        ) : null}

        {status === "ready" && !revision && !activePlan ? (
          <div className="mt-4 grid gap-3 rounded-xl border p-4">
            <p className="text-sm">
              {delegated
                ? "The owner has not prepared this plan for controlled review yet."
                : "Prepare the current plan as a draft. This does not activate or replace anything."}
            </p>
            {!delegated ? (
              <button
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
                type="button"
                disabled={Boolean(pendingAction)}
                onClick={() =>
                  void runAction(
                    "revisions/adopt-current-profile",
                    "adopt-current-profile",
                    "Current plan prepared as a draft. Review it before submitting.",
                  )
                }
              >
                {pendingAction === "adopt-current-profile"
                  ? "Preparing…"
                  : "Prepare current plan for review"}
              </button>
            ) : null}
          </div>
        ) : null}

        {status === "ready" && revision ? (
          <div className="mt-4 grid gap-4">
            {revision.state === "draft" && canEdit ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3">
                  <div>
                    <div className="text-sm font-semibold">Draft saved</div>
                    <div className="text-xs text-muted-foreground">
                      This draft is not active yet.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activePlan && !draftEditorOpen ? (
                      <button
                        className="rounded-lg border px-3 py-2 text-sm font-medium"
                        type="button"
                        onClick={() =>
                          setPlanView((current) =>
                            current === "active" ? "draft" : "active",
                          )
                        }
                      >
                        {planView === "active"
                          ? "Preview draft"
                          : "View active Plan"}
                      </button>
                    ) : null}
                    <button
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                      type="button"
                      onClick={() => {
                        setPlanView("draft");
                        setDraftEditorOpen((current) => !current);
                      }}
                    >
                      {draftEditorOpen ? "Close editor" : "Edit Plan"}
                    </button>
                  </div>
                </div>

                {draftEditorOpen ? (
                  <PlanDraftWorkspace
                    revisionId={revision.revision_id}
                    targetUserId={targetUserId}
                    document={revision.proposed_document}
                    saving={pendingAction === `save:${revision.revision_id}`}
                    onDirtyChange={setDraftHasUnsavedChanges}
                    onSave={(document) =>
                      runAction(
                        `revisions/${revision.revision_id}/draft`,
                        `save:${revision.revision_id}`,
                        "Draft saved. The active Plan has not changed.",
                        { document },
                        "PUT",
                      )
                    }
                    onSageReview={requestSageReview}
                  />
                ) : (
                  <PlanSummary
                    document={
                      planView === "draft" || !activePlan
                        ? revision.proposed_document
                        : activePlan.document
                    }
                    title={
                      planView === "draft" || !activePlan
                        ? "Draft Plan preview"
                        : "Active Plan"
                    }
                  />
                )}
              </>
            ) : null}
            {revision.state !== "draft" || !canEdit ? (
              <>
                <PlanSummary document={revision.proposed_document} />
                <ValidationSummary revision={revision} />
                <ChangeSummary changes={revision.changes} />
              </>
            ) : null}

            {revision.state === "draft" && canEdit && draftEditorOpen ? (
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <button
                  className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  type="button"
                  disabled={Boolean(pendingAction) || draftHasUnsavedChanges}
                  title={
                    draftHasUnsavedChanges
                      ? "Save the draft before continuing."
                      : undefined
                  }
                  onClick={() =>
                    void runAction(
                      `revisions/${revision.revision_id}/propose`,
                      `propose:${revision.revision_id}`,
                      delegated
                        ? "Plan submitted to the owner for review. The active Plan has not changed."
                        : "Plan is ready for your final activation review. The active Plan has not changed.",
                    )
                  }
                >
                  {pendingAction === `propose:${revision.revision_id}`
                    ? "Preparing…"
                    : draftHasUnsavedChanges
                      ? "Save draft before continuing"
                      : delegated
                        ? "Submit to owner"
                        : "Review for activation"}
                </button>
              </div>
            ) : null}

            {revision.state === "proposed" && revision.can_approve ? (
              <div className="grid gap-2 rounded-xl border p-4">
                <p className="text-sm font-medium">Ready to activate</p>
                <p className="text-sm text-muted-foreground">
                  Activation makes this exact revision the current Plan and
                  preserves the previous version in history.
                </p>
                <button
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
                  type="button"
                  disabled={Boolean(pendingAction) || !revision.base_is_current}
                  onClick={() => {
                    const confirmed = window.confirm(
                      "Activate this exact plan revision? The current plan will remain in version history.",
                    );
                    if (!confirmed) return;
                    void runAction(
                      `revisions/${revision.revision_id}/approve-and-activate`,
                      `activate:${revision.revision_id}`,
                      "Revision approved and activated.",
                    );
                  }}
                >
                  {pendingAction === `activate:${revision.revision_id}`
                    ? "Activating…"
                    : "Activate this Plan"}
                </button>
              </div>
            ) : null}

            {revision.state === "proposed" && !revision.can_approve ? (
              <p className="rounded-xl border p-3 text-sm">
                Waiting for the plan owner to review and approve this revision.
                It is not active yet.
              </p>
            ) : null}
          </div>
        ) : null}

        {status === "ready" && !revision && activePlan ? (
          <div className="mt-4 grid gap-4">
            {canEdit ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">
                  Activated {new Date(activePlan.activated_at).toLocaleString()}
                </p>
                <button
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  type="button"
                  disabled={Boolean(pendingAction)}
                  onClick={() =>
                    void runAction(
                      "revisions",
                      `direct-revision:${activePlan.plan_version_id}`,
                      `Draft ready. Active version ${activePlan.version_number} remains unchanged.`,
                      {
                        document: activePlan.document,
                        base_plan_version_id: activePlan.plan_version_id,
                      },
                    )
                  }
                >
                  {pendingAction ===
                  `direct-revision:${activePlan.plan_version_id}`
                    ? "Opening…"
                    : "Edit Plan"}
                </button>
              </div>
            ) : null}
            <PlanSummary document={activePlan.document} title="Active Plan" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
