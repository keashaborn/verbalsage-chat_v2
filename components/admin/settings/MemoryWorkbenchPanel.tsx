"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";

type WorkbenchState = "pending" | "reviewed" | "all";
type ReviewDecision = "correct" | "not_correct";
type DiagnosticCategory =
  | "context_missing"
  | "duplicate_or_repeat"
  | "missed_durable_information"
  | "incomplete_compound_extraction"
  | "incorrect_entity_or_relationship"
  | "incorrect_time_or_status"
  | "uncertainty_or_attribution_error"
  | "wrong_memory_lane"
  | "should_not_be_memory"
  | "transcription_ambiguity"
  | "other";

type WorkbenchItem = {
  packet_id: string;
  packet_storage_sha256: string;
  source: {
    text: string;
    truncated: boolean;
    recorded_at: string | null;
    context: {
      available: boolean;
      text: string;
      truncated: boolean;
      target_start: number | null;
      target_end: number | null;
    };
  };
  gpu: {
    interpretations: Array<{
      kind: "entity" | "observation" | "deferral";
      code: string;
      summary: string;
      confidence: number | null;
      reason_codes: string[];
    }>;
    entity_count: number;
    observation_count: number;
    deferral_count: number;
    manual_review_required: boolean;
    diagnostic_json: Record<string, unknown>;
  };
  routing: {
    route: string;
    reason_code: string | null;
  };
  review: {
    feedback_id: string | null;
    decision: ReviewDecision | null;
    category: DiagnosticCategory | null;
    note: string | null;
    created_at: string | null;
  };
  created_at: string | null;
};

type WorkbenchPayload = {
  ok: true;
  schema: "admin_memory_workbench_v2";
  scope: "current_actor";
  state: WorkbenchState;
  summary: {
    total: number;
    pending: number;
    correct: number;
    not_correct: number;
  };
  items: WorkbenchItem[];
  next_cursor: {
    created_at: string;
    packet_id: string;
  } | null;
};

const DIAGNOSTIC_CATEGORIES: Array<{
  value: DiagnosticCategory;
  label: string;
}> = [
  {
    value: "context_missing",
    label: "Missing context or unresolved reference",
  },
  { value: "duplicate_or_repeat", label: "Duplicate or repeated evidence" },
  {
    value: "missed_durable_information",
    label: "Missed durable information",
  },
  {
    value: "incomplete_compound_extraction",
    label: "Incomplete extraction from a long or compound statement",
  },
  {
    value: "incorrect_entity_or_relationship",
    label: "Incorrect person, pet, organization, or relationship",
  },
  {
    value: "incorrect_time_or_status",
    label: "Incorrect time, sequence, or current/past status",
  },
  {
    value: "uncertainty_or_attribution_error",
    label: "Uncertainty, opinion, or attribution handled incorrectly",
  },
  { value: "wrong_memory_lane", label: "Wrong memory category or lane" },
  { value: "should_not_be_memory", label: "Should not become memory" },
  {
    value: "transcription_ambiguity",
    label: "Speech-to-text or transcript ambiguity",
  },
  { value: "other", label: "Other problem" },
];

function diagnosticCategoryLabel(value: DiagnosticCategory | null): string {
  return (
    DIAGNOSTIC_CATEGORIES.find((item) => item.value === value)?.label ||
    "Uncategorized"
  );
}

function dateLabel(value: string | null): string {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function decisionLabel(decision: ReviewDecision | null): string {
  if (decision === "correct") return "Marked correct";
  if (decision === "not_correct") return "Marked not correct";
  return "Awaiting your review";
}

function interpretationTone(
  kind: WorkbenchItem["gpu"]["interpretations"][number]["kind"],
) {
  if (kind === "observation") {
    return "border-blue-500/25 bg-blue-500/5";
  }
  if (kind === "entity") {
    return "border-violet-500/25 bg-violet-500/5";
  }
  return "border-amber-500/25 bg-amber-500/5";
}

function SourceContext({
  context,
}: {
  context: WorkbenchItem["source"]["context"];
}) {
  if (!context.available) {
    return (
      <div className="text-xs text-muted-foreground">
        No additional source-message context is available for this item.
      </div>
    );
  }
  const validTarget =
    typeof context.target_start === "number" &&
    typeof context.target_end === "number" &&
    context.target_start >= 0 &&
    context.target_end > context.target_start &&
    context.target_end <= context.text.length;
  return (
    <div>
      <div className="text-sm whitespace-pre-wrap">
        {validTarget ? (
          <>
            {context.text.slice(0, context.target_start!)}
            <mark className="rounded bg-amber-300/40 px-0.5 text-inherit">
              {context.text.slice(context.target_start!, context.target_end!)}
            </mark>
            {context.text.slice(context.target_end!)}
          </>
        ) : (
          context.text
        )}
      </div>
      {context.truncated ? (
        <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
          Long source context was shortened around the reviewed span.
        </div>
      ) : null}
    </div>
  );
}

export function MemoryWorkbenchPanel() {
  const [filter, setFilter] = React.useState<WorkbenchState>("pending");
  const [payload, setPayload] = React.useState<WorkbenchPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [categories, setCategories] = React.useState<
    Record<string, DiagnosticCategory | "">
  >({});
  const [submitting, setSubmitting] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const search = new URLSearchParams({
          state: filter,
          limit: "10",
        });
        if (append && payload?.next_cursor) {
          search.set("before_created_at", payload.next_cursor.created_at);
          search.set("before_packet_id", payload.next_cursor.packet_id);
        }
        const response = await authFetch(
          `/api/admin/memory-workbench?${search.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );
        const body = await response.json().catch(() => null);
        if (
          !response.ok ||
          !body?.ok ||
          body?.schema !== "admin_memory_workbench_v2"
        ) {
          throw new Error("Memory Workbench is temporarily unavailable.");
        }
        setPayload((current) => {
          if (!append || !current) return body as WorkbenchPayload;
          return {
            ...(body as WorkbenchPayload),
            items: [...current.items, ...(body.items as WorkbenchItem[])],
          };
        });
        setError("");
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Memory Workbench is temporarily unavailable.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter, payload?.next_cursor],
  );

  React.useEffect(() => {
    setPayload(null);
    void load(false);
    // `load` also contains the pagination cursor. Filter changes intentionally
    // reset the list; cursor changes must not trigger an automatic reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const recordDecision = React.useCallback(
    async (item: WorkbenchItem, decision: ReviewDecision) => {
      const diagnosticCategory =
        categories[item.packet_id] || item.review.category || null;
      if (decision === "not_correct" && !diagnosticCategory) {
        setError(
          "Choose the problem category before marking this item not correct.",
        );
        return;
      }
      setSubmitting(item.packet_id);
      try {
        const response = await authFetch("/api/admin/memory-workbench", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation_id: crypto.randomUUID(),
            packet_id: item.packet_id,
            packet_storage_sha256: item.packet_storage_sha256,
            decision,
            diagnostic_category:
              decision === "not_correct" ? diagnosticCategory : null,
            diagnostic_note: notes[item.packet_id]?.trim() || null,
          }),
        });
        const body = await response.json().catch(() => null);
        if (
          !response.ok ||
          !body?.ok ||
          body?.schema !== "admin_memory_workbench_v2"
        ) {
          throw new Error("The review decision could not be recorded.");
        }
        setNotes((current) => {
          const next = { ...current };
          delete next[item.packet_id];
          return next;
        });
        setCategories((current) => {
          const next = { ...current };
          delete next[item.packet_id];
          return next;
        });
        setPayload(null);
        await load(false);
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "The review decision could not be recorded.",
        );
      } finally {
        setSubmitting(null);
      }
    },
    [categories, load, notes],
  );

  return (
    <section className="rounded-xl border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Memory Workbench</div>
          <div className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Compare what you said with what the private GPU inferred. Your
            feedback is diagnostic: it never directly edits a memory or adds
            anything to an answer. Expand an item to inspect its available
            source context and structured diagnostic JSON.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load(false)}
          disabled={loading}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {payload ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {[
            ["Awaiting review", payload.summary.pending],
            ["Marked correct", payload.summary.correct],
            ["Marked not correct", payload.summary.not_correct],
            ["Reviewable total", payload.summary.total],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border p-3">
              <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
              </div>
              <div className="mt-1 text-lg font-semibold">{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["pending", "Awaiting review"],
            ["reviewed", "Reviewed"],
            ["all", "All"],
          ] as Array<[WorkbenchState, string]>
        ).map(([state, label]) => (
          <button
            key={state}
            type="button"
            onClick={() => setFilter(state)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              filter === state
                ? "border-foreground bg-foreground text-background"
                : "hover:bg-muted/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {!loading && payload?.items.length === 0 ? (
        <div className="mt-3 rounded-lg border p-4 text-sm text-muted-foreground">
          Nothing is waiting in this view.
        </div>
      ) : null}

      <div className="mt-3 space-y-3">
        {payload?.items.map((item) => {
          const busy = submitting === item.packet_id;
          return (
            <article key={item.packet_id} className="rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold">
                  {decisionLabel(item.review.decision)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Processed {dateLabel(item.created_at)}
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    What was sent to the private GPU
                  </div>
                  <div className="mt-2 text-sm whitespace-pre-wrap">
                    {item.source.text}
                  </div>
                  {item.source.truncated ? (
                    <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                      Long source shortened for display.
                    </div>
                  ) : null}
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    What the GPU inferred
                  </div>
                  <div className="mt-2 space-y-2">
                    {item.gpu.interpretations.length > 0 ? (
                      item.gpu.interpretations.map((interpretation, index) => (
                        <div
                          key={`${interpretation.kind}-${interpretation.code}-${index}`}
                          className={`rounded-lg border p-2 text-sm ${interpretationTone(
                            interpretation.kind,
                          )}`}
                        >
                          <div>{interpretation.summary}</div>
                          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                            {interpretation.code}
                            {typeof interpretation.confidence === "number"
                              ? ` · ${Math.round(interpretation.confidence * 100)}%`
                              : ""}
                          </div>
                          {interpretation.reason_codes.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {interpretation.reason_codes.map((reason) => (
                                <span
                                  key={reason}
                                  className="rounded-full border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No structured entity, observation, or deferral was
                        stored for this packet.
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                    <span className="rounded-full border px-2 py-1">
                      {item.gpu.entity_count} entities
                    </span>
                    <span className="rounded-full border px-2 py-1">
                      {item.gpu.observation_count} observations
                    </span>
                    <span className="rounded-full border px-2 py-1">
                      {item.gpu.deferral_count} deferrals
                    </span>
                    <span className="rounded-full border px-2 py-1 font-mono">
                      {item.routing.route}
                    </span>
                    {item.routing.reason_code ? (
                      <span className="rounded-full border px-2 py-1 font-mono">
                        {item.routing.reason_code}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-xs font-semibold">
                    Available source-message context
                  </summary>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    This is the immutable source message around the reviewed
                    span. Historical GPU runs may not have received all of it.
                  </div>
                  <div className="mt-2">
                    <SourceContext context={item.source.context} />
                  </div>
                </details>

                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-xs font-semibold">
                    Structured diagnostic JSON
                  </summary>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Sanitized persisted entities, observations, deferrals,
                    routing, and reason codes. Internal owner and request
                    identifiers are omitted.
                  </div>
                  <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-muted/40 p-2 text-[10px] leading-relaxed">
                    {JSON.stringify(item.gpu.diagnostic_json, null, 2)}
                  </pre>
                </details>
              </div>

              <details className="mt-3 rounded-lg border p-3">
                <summary className="cursor-pointer text-xs font-semibold">
                  Diagnostic feedback
                </summary>
                <div className="mt-2 text-xs text-muted-foreground">
                  Choose a category when the result is wrong. The optional note
                  is for system diagnosis and is not treated as memory.
                </div>
                <label className="mt-2 block text-xs font-semibold">
                  Problem category
                  <select
                    value={
                      categories[item.packet_id] ?? item.review.category ?? ""
                    }
                    onChange={(event) =>
                      setCategories((current) => ({
                        ...current,
                        [item.packet_id]: event.target.value as
                          | DiagnosticCategory
                          | "",
                      }))
                    }
                    className="mt-1 w-full rounded-lg border bg-background p-2 text-sm font-normal"
                  >
                    <option value="">Choose when marking Not correct…</option>
                    {DIAGNOSTIC_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                {item.review.category ? (
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Recorded category:{" "}
                    {diagnosticCategoryLabel(item.review.category)}
                  </div>
                ) : null}
                <textarea
                  value={notes[item.packet_id] ?? item.review.note ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [item.packet_id]: event.target.value.slice(0, 2000),
                    }))
                  }
                  rows={3}
                  className="mt-2 w-full rounded-lg border bg-transparent p-2 text-sm"
                  placeholder="Example: It turned my question into a belief."
                />
              </details>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void recordDecision(item, "correct")}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300"
                >
                  Correct
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void recordDecision(item, "not_correct")}
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
                >
                  Not correct
                </button>
                <span className="text-[11px] text-muted-foreground">
                  Correct adds review evidence; Not correct blocks this packet
                  from staging. Neither action edits your original statement.
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {payload?.next_cursor ? (
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loadingMore}
          className="mt-3 w-full rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted/50 disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </section>
  );
}
