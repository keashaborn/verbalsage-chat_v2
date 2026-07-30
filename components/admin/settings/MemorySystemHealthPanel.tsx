"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";

type HealthStatus = "healthy" | "attention" | "critical";
type WarningSeverity = "information" | "attention" | "critical";

type MemoryHealth = {
  ok: true;
  schema: "admin_memory_health_v1";
  generated_at: string;
  scope: "current_actor";
  status: HealthStatus;
  runtime: {
    response_path: string;
    memory_mode: string;
    governed_active: boolean;
    active_for_current_actor: boolean;
    lanes: {
      claims: {
        status: "active" | "inactive";
        supported: number;
        retracted: number;
      };
      preferences: {
        status: "active" | "inactive";
        records: number;
      };
      projects: {
        status: "stored_not_response_active";
        records: number;
      };
    };
  };
  index: {
    collection: string;
    supported_claims: number;
    vector_points: number | null;
    synchronized: boolean;
  };
  processing: {
    pending: number;
    review_required: number;
    skipped: number;
    processing: number;
    error: number;
    pending_older_1d: number;
    pending_older_7d: number;
    oldest_pending_at: string | null;
    newest_job_at: string | null;
    completed_1d: number;
    completed_7d: number;
  };
  freshness: {
    last_evidence_at: string | null;
    last_claim_at: string | null;
    last_answer_at: string | null;
    last_memory_bound_at: string | null;
  };
  answer_use: {
    window_days: number;
    attested_answers: number;
    memory_bound_answers: number;
    memory_bound_percent: number;
  };
  pipeline_schema?: "memory_pipeline_status_v1";
  pipeline?: {
    stages: {
      evidence_rows: number;
      extracted_evidence_rows: number;
      durable_observations: number;
      bound_observations: number;
      evaluated_observations: number;
      claim_plan_items: number;
      reviewed_claim_plan_items: number;
      supported_claims: number;
      indexed_vectors: number | null;
      memory_bound_answers_7d: number;
    };
    backlog: {
      waiting_for_binding: number;
      waiting_for_entailment: number;
      waiting_for_claim_review: number;
      ready_for_materialization: number;
    };
  };
  warnings: Array<{
    code: string;
    severity: WarningSeverity;
    message: string;
  }>;
};

function statusLabel(status: HealthStatus): string {
  if (status === "healthy") return "Healthy";
  if (status === "critical") return "Critical";
  return "Needs attention";
}

function statusClass(status: HealthStatus | WarningSeverity): string {
  if (status === "healthy") {
    return "text-emerald-700 dark:text-emerald-300";
  }
  if (status === "critical") {
    return "text-red-700 dark:text-red-300";
  }
  if (status === "attention") {
    return "text-amber-700 dark:text-amber-300";
  }
  return "text-blue-700 dark:text-blue-300";
}

function timeLabel(value: string | null): string {
  if (!value) return "No activity recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    <div className="py-3 sm:px-3 sm:first:pl-0 sm:last:pr-0">
      <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function PipelineStage({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="min-w-24 rounded-md border bg-muted/20 px-3 py-2 text-center">
      <div className="text-base font-semibold">
        {value === null ? "—" : value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
    </div>
  );
}

export function MemorySystemHealthPanel() {
  const [health, setHealth] = React.useState<MemoryHealth | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch("/api/admin/memory-health", {
        method: "GET",
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (
        !response.ok ||
        !body?.ok ||
        body?.schema !== "admin_memory_health_v1"
      ) {
        throw new Error("Memory health is temporarily unavailable.");
      }
      setHealth(body as MemoryHealth);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Memory health is temporarily unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Governed Memory Health</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Operational status for the signed-in account. Stored memory content
            is never exposed here.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {health ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-semibold ${statusClass(health.status)}`}
            >
              {statusLabel(health.status)}
            </span>
            <span className="text-xs text-muted-foreground">
              Governed response path · current account only
            </span>
          </div>

          <div className="grid divide-y border-y md:grid-cols-4 md:divide-x md:divide-y-0">
            <Metric
              label="Governed claims"
              value={health.runtime.lanes.claims.supported}
              detail={`${health.runtime.lanes.claims.retracted} retracted`}
            />
            <Metric
              label="Claim index"
              value={health.index.synchronized ? "In sync" : "Check required"}
              detail={
                health.index.vector_points === null
                  ? "Vector count unavailable"
                  : `${health.index.vector_points} indexed vectors`
              }
            />
            <Metric
              label="Processing queue"
              value={health.processing.pending}
              detail={`${health.processing.pending_older_7d} pending over 7 days`}
            />
            <Metric
              label={`Answer use · ${health.answer_use.window_days} days`}
              value={`${health.answer_use.memory_bound_percent.toFixed(1)}%`}
              detail={`${health.answer_use.memory_bound_answers} of ${health.answer_use.attested_answers} answers used memory`}
            />
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="border-b px-3 py-2 text-xs font-semibold">
              Active memory lanes
            </div>
            <div className="grid divide-y text-xs sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="p-3">
                <div className="font-semibold">Claims</div>
                <div className="mt-1 text-muted-foreground">
                  {health.runtime.lanes.claims.status === "active"
                    ? "Active in governed responses"
                    : "Not active for this account"}
                </div>
              </div>
              <div className="p-3">
                <div className="font-semibold">Preferences</div>
                <div className="mt-1 text-muted-foreground">
                  {health.runtime.lanes.preferences.records} active response
                  preferences
                </div>
              </div>
              <div className="p-3">
                <div className="font-semibold">Projects</div>
                <div className="mt-1 text-muted-foreground">
                  {health.runtime.lanes.projects.records} stored · not active in
                  the current response path
                </div>
              </div>
            </div>
          </div>

          {health.pipeline ? (
            <div className="overflow-hidden rounded-lg border">
              <div className="border-b px-3 py-2">
                <div className="text-xs font-semibold">
                  Governed memory pipeline
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  Aggregate counts for this account. Each stage is a different
                  record type, not a conversion percentage.
                </div>
              </div>
              <div className="overflow-x-auto p-3">
                <div className="flex min-w-max items-center gap-2">
                  {[
                    ["Evidence", health.pipeline.stages.evidence_rows],
                    [
                      "Extracted",
                      health.pipeline.stages.extracted_evidence_rows,
                    ],
                    [
                      "Observations",
                      health.pipeline.stages.durable_observations,
                    ],
                    ["Bound", health.pipeline.stages.bound_observations],
                    ["Evaluated", health.pipeline.stages.evaluated_observations],
                    ["Claim plans", health.pipeline.stages.claim_plan_items],
                    [
                      "Reviewed",
                      health.pipeline.stages.reviewed_claim_plan_items,
                    ],
                    ["Active", health.pipeline.stages.supported_claims],
                    ["Indexed", health.pipeline.stages.indexed_vectors],
                    [
                      "Used · 7d",
                      health.pipeline.stages.memory_bound_answers_7d,
                    ],
                  ].map(([label, value], index, stages) => (
                    <React.Fragment key={String(label)}>
                      <PipelineStage
                        label={String(label)}
                        value={value as number | null}
                      />
                      {index < stages.length - 1 ? (
                        <span
                          aria-hidden="true"
                          className="text-sm text-muted-foreground"
                        >
                          →
                        </span>
                      ) : null}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t px-3 py-2">
                {[
                  [
                    "Awaiting entity binding",
                    health.pipeline.backlog.waiting_for_binding,
                  ],
                  [
                    "Awaiting GPU evaluation",
                    health.pipeline.backlog.waiting_for_entailment,
                  ],
                  [
                    "Awaiting claim review",
                    health.pipeline.backlog.waiting_for_claim_review,
                  ],
                  [
                    "Ready to materialize",
                    health.pipeline.backlog.ready_for_materialization,
                  ],
                ].map(([label, value]) => (
                  <span
                    key={String(label)}
                    className="rounded-full border px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    {String(label)} · {Number(value).toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid border-y text-xs sm:grid-cols-2 sm:divide-x">
            <div className="py-3 sm:pr-3">
              <div className="font-semibold">Processing</div>
              <div className="mt-1 text-muted-foreground">
                {health.processing.review_required} need review ·{" "}
                {health.processing.error} errors ·{" "}
                {health.processing.completed_7d} completed in 7 days
              </div>
              <div className="mt-1 text-muted-foreground">
                Oldest pending: {timeLabel(health.processing.oldest_pending_at)}
              </div>
            </div>
            <div className="border-t py-3 sm:border-t-0 sm:pl-3">
              <div className="font-semibold">Freshness</div>
              <div className="mt-1 text-muted-foreground">
                Latest evidence: {timeLabel(health.freshness.last_evidence_at)}
              </div>
              <div className="mt-1 text-muted-foreground">
                Latest memory-bound answer:{" "}
                {timeLabel(health.freshness.last_memory_bound_at)}
              </div>
            </div>
          </div>

          {health.warnings.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold">Review</div>
              {health.warnings.map((warning) => (
                <div
                  key={warning.code}
                  className={`border-l-2 py-1 pl-3 text-xs ${statusClass(warning.severity)}`}
                >
                  {warning.message}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-emerald-700 dark:text-emerald-300">
              No operational warnings for this account.
            </div>
          )}

          <div className="text-[11px] text-muted-foreground">
            Checked {timeLabel(health.generated_at)} · aggregate counts only
          </div>
        </div>
      ) : null}
    </section>
  );
}
