"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";

type ReviewPlanRow = {
  action?: string;
  kind?: string;
  topic_key?: string;
  summary?: string;
  confidence?: number;
  strength?: number;
  comparison_status?: string;
  best_existing_card_id?: number | string | null;
  action_reasons?: string[];
  payload?: Record<string, any>;
};

type ReviewPlanResponse = {
  ok?: boolean;
  schema?: string;
  mode?: string;
  source?: string;
  read_only?: boolean;
  endpoint?: string;
  points_scanned?: number;
  raw_candidate_count?: number;
  merged_card_candidate_count?: number;
  existing_card_count?: number;
  plan_row_count?: number;
  action_counts?: Record<string, number>;
  plan_rows?: ReviewPlanRow[];
  error?: string;
  details?: string;
};

function asText(v: any, fallback = ""): string {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function asNumber(v: any): string {
  if (typeof v === "number" && Number.isFinite(v)) return v.toFixed(2);
  const n = Number(v);
  if (Number.isFinite(n)) return n.toFixed(2);
  return "—";
}

function shortTopic(topicKey: any): string {
  const topic = String(topicKey || "").trim();
  if (!topic) return "untitled";
  const parts = topic.split("/").filter(Boolean);
  return parts.slice(-3).join("/");
}

function actionClass(action: string) {
  if (action === "create_new_card") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (action === "duplicate_or_subsumed") return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  if (action === "split_or_skip") return "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300";
  if (action === "candidate_needs_rewrite") return "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300";
  if (action === "distinct_life_context_candidate") return "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300";
  if (action === "needs_manual_review") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-muted bg-muted/30 text-muted-foreground";
}

function isReviewNeededAction(action: string): boolean {
  return new Set([
    "needs_manual_review",
    "split_or_skip",
    "candidate_needs_rewrite",
    "distinct_life_context_candidate",
  ]).has(action);
}

function formatActionLabel(action: string): string {
  return action.replace(/_/g, " ");
}

function comparisonClass(status: string) {
  if (status === "new_candidate") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "already_covered_or_duplicate") return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  if (status === "similar_existing_card" || status === "weak_existing_overlap") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-muted bg-muted/30 text-muted-foreground";
}

function countRows(rows: ReviewPlanRow[], action: string): number {
  return rows.reduce((n, r) => n + (r.action === action ? 1 : 0), 0);
}

function compactSummary(text: any, limit = 260): string {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= limit) return s;
  return s.slice(0, Math.max(0, limit - 1)).trimEnd() + "…";
}

function formatActionCounts(counts: Record<string, number> | undefined, rows: ReviewPlanRow[]): string {
  const source = counts && Object.keys(counts).length
    ? counts
    : rows.reduce<Record<string, number>>((acc, row) => {
      const action = asText(row.action, "unknown");
      acc[action] = (acc[action] || 0) + 1;
      return acc;
    }, {});

  return Object.entries(source)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([action, count]) => `${action}=${count}`)
    .join(", ");
}

function buildReviewDigest(data: ReviewPlanResponse | null, opts?: { manualOnly?: boolean }): string {
  const allRows = Array.isArray(data?.plan_rows) ? data!.plan_rows! : [];
  const rows = opts?.manualOnly ? allRows.filter((r) => isReviewNeededAction(asText(r.action, "unknown"))) : allRows;
  const lines: string[] = [];

  lines.push(opts?.manualOnly ? "Memory Review Digest - Review Needed Only" : "Memory Review Digest");
  lines.push(`schema: ${asText(data?.schema, "unknown")}`);
  lines.push(`mode: ${asText(data?.mode, "unknown")}`);
  lines.push(`source: ${asText(data?.source, "unknown")}`);
  lines.push(`read_only: ${data?.read_only === true ? "true" : "false"}`);
  lines.push(`rows: ${opts?.manualOnly ? rows.length : data?.plan_row_count ?? rows.length}`);
  lines.push(`action_counts: ${formatActionCounts(data?.action_counts, allRows)}`);
  if (opts?.manualOnly) lines.push(`filtered_to: review_needed_actions`);
  lines.push(`points_scanned: ${data?.points_scanned ?? "unknown"}`);
  lines.push(`raw_candidates: ${data?.raw_candidate_count ?? "unknown"}`);
  lines.push(`merged_candidates: ${data?.merged_card_candidate_count ?? "unknown"}`);
  lines.push(`existing_durable: ${data?.existing_card_count ?? "unknown"}`);
  lines.push("");
  lines.push("Rows:");

  rows.forEach((row, idx) => {
    const reasons = Array.isArray(row.action_reasons) ? row.action_reasons.join(", ") : "";
    lines.push(
      `${idx + 1}. ${asText(row.action, "unknown")} | ${asText(row.kind, "unknown")} | ${asText(row.comparison_status, "unknown")} | best_existing=${row.best_existing_card_id ?? "—"} | confidence=${asNumber(row.confidence)}`
    );
    lines.push(`   ${shortTopic(row.topic_key)}`);
    lines.push(`   ${compactSummary(row.summary, 300) || "No summary."}`);
    if (reasons) lines.push(`   reasons: ${reasons}`);
  });

  return lines.join("\n");
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function MemoryReviewPanel() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<ReviewPlanResponse | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);
  const [manualOnly, setManualOnly] = React.useState(false);
  const [copyStatus, setCopyStatus] = React.useState("");

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const r = await authFetch("/api/admin/memory-review", {
        method: "GET",
        cache: "no-store",
      });

      const txt = await r.text().catch(() => "");
      let j: ReviewPlanResponse | null = null;
      try {
        j = txt ? JSON.parse(txt) : null;
      } catch {
        throw new Error(txt || `HTTP ${r.status}`);
      }

      if (!r.ok) {
        throw new Error(j?.details || j?.error || txt || `HTTP ${r.status}`);
      }

      setData(j || {});
      setExpandedKey(null);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function copyDigest() {
    if (!data) return;
    const ok = await copyTextToClipboard(buildReviewDigest(data));
    setCopyStatus(ok ? "digest copied" : "copy failed");
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  async function copyManualDigest() {
    if (!data) return;
    const ok = await copyTextToClipboard(buildReviewDigest(data, { manualOnly: true }));
    setCopyStatus(ok ? "manual digest copied" : "copy failed");
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  async function copyJson() {
    if (!data) return;
    const ok = await copyTextToClipboard(JSON.stringify(data, null, 2));
    setCopyStatus(ok ? "json copied" : "copy failed");
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  const rows = Array.isArray(data?.plan_rows) ? data!.plan_rows! : [];
  const visibleRows = manualOnly ? rows.filter((r) => isReviewNeededAction(asText(r.action, "unknown"))) : rows;
  const actionCounts = data?.action_counts || {};

  const stats = {
    total: data?.plan_row_count ?? rows.length,
    create: actionCounts.create_new_card ?? countRows(rows, "create_new_card"),
    reviewNeeded: rows.filter((r) => isReviewNeededAction(asText(r.action, "unknown"))).length,
    duplicate: actionCounts.duplicate_or_subsumed ?? countRows(rows, "duplicate_or_subsumed"),
    splitOrSkip: actionCounts.split_or_skip ?? countRows(rows, "split_or_skip"),
    rewrite: actionCounts.candidate_needs_rewrite ?? countRows(rows, "candidate_needs_rewrite"),
    distinctLife: actionCounts.distinct_life_context_candidate ?? countRows(rows, "distinct_life_context_candidate"),
  };

  return (
    <details
      className="rounded-xl border p-3"
      open={open}
      onToggle={(e) => {
        if (e.currentTarget !== e.target) return;
        const isOpen = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(isOpen);
        if (isOpen && !data && !loading) load();
      }}
    >
      <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Memory Review / Candidate Testing
      </summary>

      <div className="mt-3 space-y-3">
        <div className="rounded-xl border bg-muted/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Read-only promotion review plan</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Shows candidate memory cards, duplicate comparisons, and proposed actions. This panel does not approve, write, or promote cards.
              </div>
              {data ? (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {asText(data.schema, "unknown schema")} · {asText(data.mode, "unknown mode")} · source: {asText(data.source, "unknown")}
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {data ? (
                <>
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50"
                    onClick={copyDigest}
                  >
                    Copy Digest
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50"
                    onClick={copyManualDigest}
                  >
                    Copy Manual
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50"
                    onClick={copyJson}
                  >
                    Copy JSON
                  </button>
                </>
              ) : null}

              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={load}
                disabled={loading}
              >
                {loading ? "Loading…" : data ? "Refresh" : "Load"}
              </button>
            </div>
          </div>
        </div>

        {err ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
            {err}
          </div>
        ) : null}

        {data ? (
          <>
            <div className="grid gap-2 md:grid-cols-4">
              <div className="rounded-xl border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Rows</div>
                <div className="mt-1 text-lg font-semibold">{stats.total}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Create</div>
                <div className="mt-1 text-lg font-semibold">{stats.create}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Review Needed</div>
                <div className="mt-1 text-lg font-semibold">{stats.reviewNeeded}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Duplicate/Subsumed</div>
                <div className="mt-1 text-lg font-semibold">{stats.duplicate}</div>
              </div>
            </div>

            <div className="grid gap-2 text-xs md:grid-cols-4">
              <div className="rounded-lg border p-2">
                <div className="font-semibold">{data.points_scanned ?? "—"}</div>
                <div className="text-muted-foreground">points scanned</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="font-semibold">{data.raw_candidate_count ?? "—"}</div>
                <div className="text-muted-foreground">raw candidates</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="font-semibold">{data.merged_card_candidate_count ?? "—"}</div>
                <div className="text-muted-foreground">merged candidates</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="font-semibold">{data.existing_card_count ?? "—"}</div>
                <div className="text-muted-foreground">existing durable</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={manualOnly}
                  onChange={(e) => setManualOnly(e.target.checked)}
                />
                Show review-needed rows only
              </label>

              <div className="text-xs text-muted-foreground">
                Showing {visibleRows.length} of {rows.length} rows{copyStatus ? ` · ${copyStatus}` : ""}
              </div>
            </div>

            <div className="space-y-2">
              {visibleRows.map((row, idx) => {
                const key = `${idx}:${row.topic_key || row.summary || "row"}`;
                const isOpen = expandedKey === key;
                const action = asText(row.action, "unknown");
                const comparison = asText(row.comparison_status, "unknown");

                return (
                  <div key={key} className="rounded-lg border px-3 py-2">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setExpandedKey(isOpen ? null : key)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{shortTopic(row.topic_key)}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {manualOnly ? "manual" : idx + 1}. {asText(row.kind, "unknown")} · confidence {asNumber(row.confidence)} · best existing {row.best_existing_card_id ?? "—"}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap justify-end gap-1 text-[10px] uppercase tracking-wide">
                          <span className={`rounded-full border px-2 py-0.5 ${actionClass(action)}`}>{formatActionLabel(action)}</span>
                          <span className={`rounded-full border px-2 py-0.5 ${comparisonClass(comparison)}`}>{comparison}</span>
                        </div>
                      </div>

                      <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                        {asText(row.summary, "No summary.")}
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="mt-2 space-y-2 border-t pt-2 text-[11px] text-muted-foreground">
                        <div className="break-all">
                          <span className="font-semibold">topic_key:</span> {row.topic_key || "—"}
                        </div>
                        <div>
                          <span className="font-semibold">strength:</span> {asNumber(row.strength)} ·{" "}
                          <span className="font-semibold">confidence:</span> {asNumber(row.confidence)}
                        </div>
                        {row.action_reasons?.length ? (
                          <div>
                            <div className="font-semibold">reasons:</div>
                            <ul className="mt-1 list-disc space-y-0.5 pl-5">
                              {row.action_reasons.map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {!loading && visibleRows.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                {rows.length === 0 ? "No review rows returned." : "No rows match the current filter."}
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-xs text-muted-foreground">
            Open this panel or press Load to fetch the current read-only promotion plan.
          </div>
        )}
      </div>
    </details>
  );
}
