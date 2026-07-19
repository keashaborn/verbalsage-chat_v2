"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import {
  PlanDraftWorkspace,
  type JsonObject,
  type PlanDocument,
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

function PlanSummary({ document }: { document: PlanDocument }) {
  return (
    <div className="grid gap-3">
      <dl className="grid gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-2">
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
          <dd className="mt-1 text-sm">{humanize(document.review_cadence)}</dd>
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
          <dd className="mt-1 text-sm">{document.start_date || "Not set"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Next review
          </dt>
          <dd className="mt-1 text-sm">{document.review_date || "Not set"}</dd>
        </div>
      </dl>

      {SECTION_LABELS.map(([field, label]) => {
        const values = document[field] as JsonObject;
        const entries = Object.entries(values || {});
        return (
          <details key={field} className="rounded-xl border bg-background">
            <summary className="cursor-pointer px-3 py-3 text-sm font-medium">
              {label}
            </summary>
            <dl className="grid gap-3 border-t px-3 py-3 sm:grid-cols-2">
              {entries.length ? (
                entries.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {humanize(key)}
                    </dt>
                    <dd className="mt-1 text-sm break-words">
                      {formatValue(value)}
                    </dd>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">
                  No targets defined.
                </div>
              )}
            </dl>
          </details>
        );
      })}

      {document.coach_notes ? (
        <details className="rounded-xl border bg-background">
          <summary className="cursor-pointer px-3 py-3 text-sm font-medium">
            Coach notes
          </summary>
          <p className="border-t px-3 py-3 text-sm whitespace-pre-wrap">
            {document.coach_notes}
          </p>
        </details>
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

  const revision = workspace?.open_revision || null;
  const activePlan = workspace?.active_plan || null;
  const canEdit = workspace?.capabilities?.can_edit ?? !delegated;
  const isInitialAdoption = Boolean(revision && !revision.base_plan_version_id);

  return (
    <section className="mx-auto grid max-w-6xl gap-4 px-4 pt-4 md:px-6 md:pt-6">
      <div className="rounded-2xl border bg-background p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Controlled plan workflow
            </div>
            <h1 className="mt-1 text-xl font-semibold">
              Plan review and activation
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Build an inactive draft, review the evidence and changes, then
              activate it only after the owner approves.
            </p>
          </div>
          {revision ? (
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
            {revision.source?.legacy_profile_updated_at ? (
              <p className="text-xs text-muted-foreground">
                Draft originally copied from the legacy plan editor at{" "}
                {new Date(
                  revision.source.legacy_profile_updated_at,
                ).toLocaleString()}
                .
              </p>
            ) : null}
            {revision.state === "draft" && canEdit ? (
              <PlanDraftWorkspace
                revisionId={revision.revision_id}
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
              />
            ) : null}
            {revision.state !== "draft" || !canEdit ? (
              <>
                <PlanSummary document={revision.proposed_document} />
                <ValidationSummary revision={revision} />
                <ChangeSummary changes={revision.changes} />
              </>
            ) : null}

            {revision.state === "draft" ? (
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                {canEdit &&
                revision.source &&
                (!isInitialAdoption || !delegated) ? (
                  <button
                    className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50"
                    type="button"
                    disabled={Boolean(pendingAction)}
                    onClick={() =>
                      void runAction(
                        isInitialAdoption
                          ? "revisions/adopt-current-profile/refresh"
                          : `revisions/${revision.revision_id}/refresh-current-profile`,
                        `refresh:${revision.revision_id}`,
                        "Draft refreshed from the plan editor.",
                      )
                    }
                  >
                    {pendingAction === `refresh:${revision.revision_id}`
                      ? "Refreshing…"
                      : "Refresh draft from editor below"}
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    type="button"
                    disabled={Boolean(pendingAction) || draftHasUnsavedChanges}
                    title={
                      draftHasUnsavedChanges
                        ? "Save the draft before submitting it for approval."
                        : undefined
                    }
                    onClick={() =>
                      void runAction(
                        `revisions/${revision.revision_id}/propose`,
                        `propose:${revision.revision_id}`,
                        "Revision submitted for owner approval. The active plan has not changed.",
                      )
                    }
                  >
                    {pendingAction === `propose:${revision.revision_id}`
                      ? "Submitting…"
                      : draftHasUnsavedChanges
                        ? "Save draft before submitting"
                        : "Submit for approval"}
                  </button>
                ) : null}
              </div>
            ) : null}

            {revision.state === "proposed" && revision.can_approve ? (
              <div className="grid gap-2 rounded-xl border p-4">
                <p className="text-sm font-medium">Owner approval required</p>
                <p className="text-sm text-muted-foreground">
                  Approval activates this exact revision and preserves the
                  previous plan version.
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
                    : "Approve and activate"}
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
            <div className="grid gap-3 rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                Activated {new Date(activePlan.activated_at).toLocaleString()}.
                Version {activePlan.version_number} remains authoritative until
                the owner approves a replacement.
              </p>
              {canEdit ? (
                <div className="grid gap-3">
                  <p className="text-sm">
                    Start an inactive copy of the active Plan, then edit it
                    directly or use the guided setup. Nothing changes in the
                    active version while you work.
                  </p>
                  <button
                    className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
                    type="button"
                    disabled={Boolean(pendingAction)}
                    onClick={() =>
                      void runAction(
                        "revisions",
                        `direct-revision:${activePlan.plan_version_id}`,
                        "Inactive draft created from the active Plan.",
                        {
                          document: activePlan.document,
                          base_plan_version_id: activePlan.plan_version_id,
                        },
                      )
                    }
                  >
                    {pendingAction ===
                    `direct-revision:${activePlan.plan_version_id}`
                      ? "Creating draft…"
                      : "Start a new draft"}
                  </button>
                  <details className="rounded-xl border bg-background">
                    <summary className="cursor-pointer px-3 py-3 text-sm font-medium">
                      Import from the legacy editor below
                    </summary>
                    <div className="grid gap-3 border-t p-3">
                      <p className="text-sm text-muted-foreground">
                        Use this only when you already changed the older Plan
                        editor and want those values copied into a draft.
                      </p>
                      <button
                        className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50"
                        type="button"
                        disabled={Boolean(pendingAction)}
                        onClick={() =>
                          void runAction(
                            "revisions/from-current-profile",
                            `profile-revision:${activePlan.plan_version_id}`,
                            "Legacy editor changes imported as an inactive draft.",
                          )
                        }
                      >
                        {pendingAction ===
                        `profile-revision:${activePlan.plan_version_id}`
                          ? "Importing…"
                          : "Import editor changes"}
                      </button>
                    </div>
                  </details>
                </div>
              ) : (
                <p className="text-sm">
                  There is no revision waiting for your review.
                </p>
              )}
            </div>
            <PlanSummary document={activePlan.document} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
