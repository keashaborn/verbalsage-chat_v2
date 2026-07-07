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
  if (action === "needs_manual_review") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (action === "skip_duplicate") return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  return "border-muted bg-muted/30 text-muted-foreground";
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

export function MemoryReviewPanel() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<ReviewPlanResponse | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);

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

  const rows = Array.isArray(data?.plan_rows) ? data!.plan_rows! : [];
  const actionCounts = data?.action_counts || {};

  const stats = {
    total: data?.plan_row_count ?? rows.length,
    create: actionCounts.create_new_card ?? countRows(rows, "create_new_card"),
    manual: actionCounts.needs_manual_review ?? countRows(rows, "needs_manual_review"),
    duplicate: actionCounts.skip_duplicate ?? countRows(rows, "skip_duplicate"),
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

            <button
              type="button"
              className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={load}
              disabled={loading}
            >
              {loading ? "Loading…" : data ? "Refresh" : "Load"}
            </button>
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
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Manual Review</div>
                <div className="mt-1 text-lg font-semibold">{stats.manual}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Duplicates</div>
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

            <div className="space-y-2">
              {rows.map((row, idx) => {
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
                            {idx + 1}. {asText(row.kind, "unknown")} · confidence {asNumber(row.confidence)} · best existing {row.best_existing_card_id ?? "—"}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap justify-end gap-1 text-[10px] uppercase tracking-wide">
                          <span className={`rounded-full border px-2 py-0.5 ${actionClass(action)}`}>{action}</span>
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

            {!loading && rows.length === 0 ? (
              <div className="text-xs text-muted-foreground">No review rows returned.</div>
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
