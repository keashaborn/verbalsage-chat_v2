"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";

type UsageWindow = 7 | 30 | 90;
type UsageSort =
  | "total_tokens_desc"
  | "ai_requests_desc"
  | "nutrition_days_desc"
  | "training_sessions_desc"
  | "last_activity_desc";

type UsageMetrics = {
  ai: {
    requests: number;
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
    reasoning_output_tokens: number;
    total_tokens: number;
    first_recorded_at: string | null;
    last_recorded_at: string | null;
  };
  nutrition: {
    days_logged: number;
    days_completed: number;
    entries: number;
  };
  training: {
    strength_sessions: number;
    conditioning_sessions: number;
    total_sessions: number;
  };
  last_activity_at: string | null;
};

type UsageIdentity = {
  email: string;
  role: "owner" | "admin" | "member";
  last_sign_in_at: string | null;
};

type OverviewPayload = {
  ok: true;
  schema: "admin_usage_overview_v1";
  window_days: UsageWindow;
  generated_at: string;
  ai_tracking_started_at: string | null;
  last_activity_at: string | null;
  active_users: number;
  ai: UsageMetrics["ai"];
  nutrition: Omit<UsageMetrics["nutrition"], "entries">;
  training: UsageMetrics["training"];
};

type UsageUser = UsageMetrics & {
  user_id: string;
  identity: UsageIdentity | null;
};

type UsersPayload = {
  ok: true;
  schema: "admin_usage_users_v1";
  window_days: UsageWindow;
  generated_at: string;
  sort: UsageSort;
  query: string | null;
  limit: number;
  items: UsageUser[];
  next_cursor: string | null;
  has_more: boolean;
};

type UserDetailPayload = {
  ok: true;
  schema: "admin_usage_user_detail_v1";
  window_days: UsageWindow;
  generated_at: string;
  user_id: string;
  identity: UsageIdentity | null;
  summary: UsageMetrics & {
    ai: UsageMetrics["ai"] & {
      by_model: {
        model: string;
        requests: number;
        input_tokens: number;
        cached_input_tokens: number;
        output_tokens: number;
        reasoning_output_tokens: number;
        total_tokens: number;
      }[];
      by_channel: {
        channel: string;
        requests: number;
        total_tokens: number;
      }[];
    };
  };
  daily: {
    day: string;
    ai_requests: number;
    total_tokens: number;
    nutrition_day_logged: number;
    nutrition_day_completed: number;
    strength_sessions: number;
    conditioning_sessions: number;
  }[];
};

const WINDOWS: { value: UsageWindow; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

const SORTS: { value: UsageSort; label: string }[] = [
  { value: "total_tokens_desc", label: "Most AI tokens" },
  { value: "ai_requests_desc", label: "Most AI requests" },
  { value: "nutrition_days_desc", label: "Most nutrition days" },
  { value: "training_sessions_desc", label: "Most training sessions" },
  { value: "last_activity_desc", label: "Most recent activity" },
];

function number(value: number): string {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function date(value: string | null): string {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function ErrorCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700">
      {children}
    </div>
  );
}

export function UsageAnalyticsPanel() {
  const [windowDays, setWindowDays] = React.useState<UsageWindow>(30);
  const [sort, setSort] = React.useState<UsageSort>("total_tokens_desc");
  const [queryInput, setQueryInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = React.useState<(string | null)[]>(
    [],
  );
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const [overview, setOverview] = React.useState<OverviewPayload | null>(null);
  const [overviewLoading, setOverviewLoading] = React.useState(true);
  const [overviewError, setOverviewError] = React.useState("");
  const [users, setUsers] = React.useState<UsersPayload | null>(null);
  const [usersLoading, setUsersLoading] = React.useState(true);
  const [usersError, setUsersError] = React.useState("");
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(
    null,
  );
  const [detail, setDetail] = React.useState<UserDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState("");

  const resetPage = React.useCallback(() => {
    setCursor(null);
    setCursorHistory([]);
    setSelectedUserId(null);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setOverviewLoading(true);
      setOverviewError("");
      try {
        const response = await authFetch(
          `/api/admin/usage/overview?window=${windowDays}`,
          { method: "GET", cache: "no-store" },
        );
        const value = (await response.json().catch(() => null)) as
          | OverviewPayload
          | null;
        if (
          !response.ok ||
          !value?.ok ||
          value.schema !== "admin_usage_overview_v1"
        ) {
          throw new Error("Usage overview could not be loaded.");
        }
        if (!cancelled) setOverview(value);
      } catch (caught: any) {
        if (!cancelled) {
          setOverview(null);
          setOverviewError(
            caught?.message || "Usage overview could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [windowDays, refreshNonce]);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setUsersLoading(true);
      setUsersError("");
      try {
        const params = new URLSearchParams({
          window: String(windowDays),
          limit: "25",
          sort,
        });
        if (query) params.set("query", query);
        if (cursor) params.set("cursor", cursor);
        const response = await authFetch(
          `/api/admin/usage/users?${params.toString()}`,
          { method: "GET", cache: "no-store" },
        );
        const value = (await response.json().catch(() => null)) as
          | UsersPayload
          | null;
        if (
          !response.ok ||
          !value?.ok ||
          value.schema !== "admin_usage_users_v1" ||
          !Array.isArray(value.items)
        ) {
          throw new Error("Usage users could not be loaded.");
        }
        if (!cancelled) setUsers(value);
      } catch (caught: any) {
        if (!cancelled) {
          setUsers(null);
          setUsersError(
            caught?.message || "Usage users could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [windowDays, sort, query, cursor, refreshNonce]);

  React.useEffect(() => {
    if (!selectedUserId) {
      setDetail(null);
      setDetailError("");
      return;
    }
    let cancelled = false;
    const load = async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const response = await authFetch(
          `/api/admin/usage/users/${encodeURIComponent(selectedUserId)}?window=${windowDays}`,
          { method: "GET", cache: "no-store" },
        );
        const value = (await response.json().catch(() => null)) as
          | UserDetailPayload
          | null;
        if (
          !response.ok ||
          !value?.ok ||
          value.schema !== "admin_usage_user_detail_v1" ||
          value.user_id !== selectedUserId
        ) {
          throw new Error("User usage detail could not be loaded.");
        }
        if (!cancelled) setDetail(value);
      } catch (caught: any) {
        if (!cancelled) {
          setDetail(null);
          setDetailError(
            caught?.message || "User usage detail could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedUserId, windowDays, refreshNonce]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Period</span>
          <select
            value={windowDays}
            onChange={(event) => {
              setWindowDays(Number(event.target.value) as UsageWindow);
              resetPage();
            }}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm"
          >
            {WINDOWS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setRefreshNonce((value) => value + 1)}
          disabled={overviewLoading || usersLoading}
          className="rounded-lg border px-2.5 py-1 text-xs disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {overviewLoading ? (
        <div className="rounded-xl border p-3 text-xs text-muted-foreground">
          Loading overview…
        </div>
      ) : overviewError ? (
        <ErrorCard>{overviewError}</ErrorCard>
      ) : overview ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Active users"
              value={number(overview.active_users)}
              detail={`Any measured activity in ${windowDays} days`}
            />
            <Metric
              label="AI requests"
              value={number(overview.ai.requests)}
              detail={`${number(overview.ai.total_tokens)} exact tokens`}
            />
            <Metric
              label="Nutrition"
              value={`${number(overview.nutrition.days_logged)} days`}
              detail={`${number(overview.nutrition.days_completed)} completed`}
            />
            <Metric
              label="Training"
              value={`${number(overview.training.total_sessions)} sessions`}
              detail={`${number(overview.training.strength_sessions)} strength · ${number(overview.training.conditioning_sessions)} conditioning`}
            />
          </div>
          <div className="rounded-xl border p-3 text-xs text-muted-foreground">
            AI tracking: {date(overview.ai_tracking_started_at)}. Earlier usage
            is not estimated or backfilled. Pricing is omitted until a
            versioned rate catalog is released.
          </div>
        </>
      ) : null}

      <div className="space-y-3 rounded-xl border p-3">
        <div>
          <div className="text-sm font-semibold">User explorer</div>
          <div className="text-xs text-muted-foreground">
            Server-paginated accounts with measured activity in this period.
            Identity is resolved only for this page.
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <form
            className="min-w-[220px] flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(queryInput.trim().toLowerCase());
              resetPage();
            }}
          >
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">
                User ID prefix
              </span>
              <div className="flex gap-2">
                <input
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  maxLength={64}
                  placeholder="UUID prefix"
                  className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-lg border px-3 py-1.5 text-xs"
                >
                  Search
                </button>
              </div>
            </label>
          </form>
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">Sort</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as UsageSort);
                resetPage();
              }}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm"
            >
              {SORTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {usersLoading ? (
          <div className="text-xs text-muted-foreground">Loading users…</div>
        ) : usersError ? (
          <ErrorCard>{usersError}</ErrorCard>
        ) : users?.items.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            No measured activity matched this period and query.
          </div>
        ) : users ? (
          <div className="divide-y rounded-lg border">
            {users.items.map((user) => (
              <button
                key={user.user_id}
                type="button"
                onClick={() =>
                  setSelectedUserId((current) =>
                    current === user.user_id ? null : user.user_id,
                  )
                }
                className="block w-full p-3 text-left hover:bg-muted/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {user.identity?.email || user.user_id}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {user.identity?.role || "Identity unavailable"} · Last
                      activity {date(user.last_activity_at)}
                    </div>
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    <div>{number(user.ai.total_tokens)} AI tokens</div>
                    <div className="text-muted-foreground">
                      {number(user.ai.requests)} requests
                    </div>
                  </div>
                </div>
                <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-3">
                  <div>
                    Nutrition: {number(user.nutrition.days_logged)} days
                  </div>
                  <div>
                    Strength: {number(user.training.strength_sessions)}
                  </div>
                  <div>
                    Conditioning:{" "}
                    {number(user.training.conditioning_sessions)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={cursorHistory.length === 0 || usersLoading}
            onClick={() => {
              const previous = cursorHistory[cursorHistory.length - 1] ?? null;
              setCursor(previous);
              setCursorHistory((values) => values.slice(0, -1));
              setSelectedUserId(null);
            }}
            className="rounded-lg border px-3 py-1 text-xs disabled:opacity-40"
          >
            Previous
          </button>
          <div className="text-[11px] text-muted-foreground">
            Up to 25 users per page
          </div>
          <button
            type="button"
            disabled={!users?.next_cursor || usersLoading}
            onClick={() => {
              if (!users?.next_cursor) return;
              setCursorHistory((values) => [...values, cursor]);
              setCursor(users.next_cursor);
              setSelectedUserId(null);
            }}
            className="rounded-lg border px-3 py-1 text-xs disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {selectedUserId ? (
        <div className="space-y-3 rounded-xl border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">User detail</div>
              <div className="text-xs text-muted-foreground">
                {detail?.identity?.email || selectedUserId}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedUserId(null)}
              className="rounded-lg border px-2.5 py-1 text-xs"
            >
              Close
            </button>
          </div>

          {detailLoading ? (
            <div className="text-xs text-muted-foreground">
              Loading user detail…
            </div>
          ) : detailError ? (
            <ErrorCard>{detailError}</ErrorCard>
          ) : detail ? (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <Metric
                  label="AI"
                  value={`${number(detail.summary.ai.total_tokens)} tokens`}
                  detail={`${number(detail.summary.ai.requests)} requests`}
                />
                <Metric
                  label="Nutrition"
                  value={`${number(detail.summary.nutrition.days_logged)} days`}
                  detail={`${number(detail.summary.nutrition.days_completed)} completed`}
                />
                <Metric
                  label="Training"
                  value={`${number(detail.summary.training.total_sessions)} sessions`}
                  detail={`${number(detail.summary.training.strength_sessions)} strength · ${number(detail.summary.training.conditioning_sessions)} conditioning`}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border p-2.5">
                  <div className="text-xs font-medium">AI by model</div>
                  <div className="mt-2 space-y-1 text-xs">
                    {detail.summary.ai.by_model.length === 0 ? (
                      <div className="text-muted-foreground">
                        No AI usage recorded.
                      </div>
                    ) : (
                      detail.summary.ai.by_model.map((row) => (
                        <div
                          key={row.model}
                          className="flex justify-between gap-3"
                        >
                          <span className="truncate">{row.model}</span>
                          <span className="tabular-nums">
                            {number(row.total_tokens)} tokens
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded-lg border p-2.5">
                  <div className="text-xs font-medium">AI by channel</div>
                  <div className="mt-2 space-y-1 text-xs">
                    {detail.summary.ai.by_channel.length === 0 ? (
                      <div className="text-muted-foreground">
                        No AI usage recorded.
                      </div>
                    ) : (
                      detail.summary.ai.by_channel.map((row) => (
                        <div
                          key={row.channel}
                          className="flex justify-between gap-3"
                        >
                          <span className="capitalize">{row.channel}</span>
                          <span className="tabular-nums">
                            {number(row.requests)} requests ·{" "}
                            {number(row.total_tokens)} tokens
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[620px] text-xs">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-2.5 py-2 font-medium">Day</th>
                      <th className="px-2.5 py-2 font-medium">AI requests</th>
                      <th className="px-2.5 py-2 font-medium">Tokens</th>
                      <th className="px-2.5 py-2 font-medium">Nutrition</th>
                      <th className="px-2.5 py-2 font-medium">Strength</th>
                      <th className="px-2.5 py-2 font-medium">
                        Conditioning
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detail.daily.map((row) => (
                      <tr key={row.day}>
                        <td className="px-2.5 py-2">{date(row.day)}</td>
                        <td className="px-2.5 py-2 tabular-nums">
                          {number(row.ai_requests)}
                        </td>
                        <td className="px-2.5 py-2 tabular-nums">
                          {number(row.total_tokens)}
                        </td>
                        <td className="px-2.5 py-2 tabular-nums">
                          {row.nutrition_day_logged
                            ? row.nutrition_day_completed
                              ? "Logged · completed"
                              : "Logged"
                            : "—"}
                        </td>
                        <td className="px-2.5 py-2 tabular-nums">
                          {number(row.strength_sessions)}
                        </td>
                        <td className="px-2.5 py-2 tabular-nums">
                          {number(row.conditioning_sessions)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
