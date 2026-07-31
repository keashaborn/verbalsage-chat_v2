"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";

type IncidentState = "open" | "acknowledged" | "resolved";

type AiOperationsIncident = {
  incident_id: string;
  monitor_name: string;
  state: IncidentState;
  severity: "info" | "warning" | "critical" | "test";
  is_drill: boolean;
  observation_status: "violated" | "unavailable" | "drill";
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  observation_count: number;
  reason_codes: string[];
  window_hours: number;
  request_count: number;
  completed_count: number;
  fail_closed_count: number;
  relevance_fail_closed_count: number;
  dependency_failure_count: number;
  fail_closed_rate: number;
};

type IncidentFilter = "all" | IncidentState;

const FILTERS: { value: IncidentFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
];

function label(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function dateTime(value: string | null): string {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function percent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${(value * 100).toFixed(value > 0 && value < 0.01 ? 2 : 1)}%`;
}

function statusTone(incident: AiOperationsIncident): string {
  if (incident.severity === "critical") {
    return "border-red-500/40 bg-red-500/5";
  }
  if (incident.state === "open") {
    return "border-amber-500/40 bg-amber-500/5";
  }
  return "border-muted/30 bg-muted/5";
}

export function AiOperationsPanel() {
  const [filter, setFilter] = React.useState<IncidentFilter>("all");
  const [items, setItems] = React.useState<AiOperationsIncident[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [lastLoadedAt, setLastLoadedAt] = React.useState<Date | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: "50" });
    if (filter !== "all") params.set("state", filter);
    try {
      const response = await authFetch(
        `/api/admin/ai-operations/incidents?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => null);
      if (
        !response.ok ||
        !payload?.ok ||
        payload?.schema !== "admin_ai_operations_incidents_v1" ||
        !Array.isArray(payload?.items)
      ) {
        throw new Error("AI Operations could not be loaded.");
      }
      setItems(payload.items);
      setLastLoadedAt(new Date());
    } catch {
      setItems([]);
      setError("AI Operations could not be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCount = items.filter((item) => item.state === "open").length;
  const criticalCount = items.filter(
    (item) => item.severity === "critical" && item.state !== "resolved",
  ).length;

  return (
    <div className="space-y-4 py-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border-y border-muted/20 py-3">
          <div className="text-xs text-muted-foreground">Visible incidents</div>
          <div className="mt-1 text-xl font-semibold">{items.length}</div>
        </div>
        <div className="border-y border-muted/20 py-3">
          <div className="text-xs text-muted-foreground">Open</div>
          <div className="mt-1 text-xl font-semibold">{openCount}</div>
        </div>
        <div className="border-y border-muted/20 py-3">
          <div className="text-xs text-muted-foreground">Active critical</div>
          <div className="mt-1 text-xl font-semibold">{criticalCount}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-2"
          aria-label="Incident state filter"
        >
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filter === option.value
                  ? "border-foreground/30 bg-foreground text-background"
                  : "border-muted/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border border-muted/40 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="text-xs text-muted-foreground">
        Private operational metadata only. Prompts, queries, URLs, retrieved
        content, and answer text are not stored here.
        {lastLoadedAt
          ? ` Last refreshed ${dateTime(lastLoadedAt.toISOString())}.`
          : ""}
      </div>

      {error ? (
        <div className="border-y border-red-500/40 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="border-y border-muted/20 py-6 text-sm text-muted-foreground">
          No monitor incidents match this filter.
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((incident) => (
          <article
            key={incident.incident_id}
            className={`rounded-xl border p-4 ${statusTone(incident)}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">
                    {label(incident.monitor_name)}
                  </h3>
                  <span className="rounded-full border border-muted/40 px-2 py-0.5 text-[11px] font-semibold">
                    {label(incident.state)}
                  </span>
                  <span className="rounded-full border border-muted/40 px-2 py-0.5 text-[11px] font-semibold">
                    {label(incident.severity)}
                  </span>
                  {incident.is_drill ? (
                    <span className="rounded-full border border-sky-500/40 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                      Safe drill
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Last observed {dateTime(incident.last_seen_at)} · window{" "}
                  {incident.window_hours}h · {incident.observation_count}{" "}
                  observation{incident.observation_count === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Requests</dt>
                <dd className="mt-1 font-semibold">{incident.request_count}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Completed</dt>
                <dd className="mt-1 font-semibold">
                  {incident.completed_count}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fail-closed</dt>
                <dd className="mt-1 font-semibold">
                  {incident.fail_closed_count} (
                  {percent(incident.fail_closed_rate)})
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Dependencies</dt>
                <dd className="mt-1 font-semibold">
                  {incident.dependency_failure_count}
                </dd>
              </div>
            </dl>

            <div className="mt-3 text-xs text-muted-foreground">
              Reasons:{" "}
              {incident.reason_codes.length
                ? incident.reason_codes.map(label).join(", ")
                : "None"}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
