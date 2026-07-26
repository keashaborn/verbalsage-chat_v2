"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";

type AdminAccess = {
  user_id: string;
  role: "owner" | "admin";
  role_label: "Owner" | "Admin";
};

type AccessRequest = {
  id: string;
  email: string;
  requested_name: string | null;
  request_message: string | null;
  status: "pending" | "approved" | "declined";
  request_count: number;
  created_at: string;
  last_requested_at: string;
  reviewed_at: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function AccessRequestsPanel({ access }: { access: AdminAccess }) {
  const [requests, setRequests] = React.useState<AccessRequest[]>([]);
  const [loading, setLoading] = React.useState(access.role === "owner");
  const [loadError, setLoadError] = React.useState("");
  const [actionError, setActionError] = React.useState("");
  const [confirmation, setConfirmation] = React.useState<{
    requestId: string;
    decision: "approve" | "decline";
  } | null>(null);
  const [changingRequestId, setChangingRequestId] = React.useState("");

  const loadRequests = React.useCallback(async () => {
    if (access.role !== "owner") return;
    setLoading(true);
    setLoadError("");
    try {
      const response = await authFetch("/api/admin/access-requests", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !Array.isArray(payload.requests)) {
        throw new Error(
          payload?.error === "owner_access_required"
            ? "Only the Owner can review access requests."
            : "Access requests could not be loaded.",
        );
      }
      setRequests(payload.requests);
    } catch (error: any) {
      setRequests([]);
      setLoadError(error?.message || "Access requests could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [access.role]);

  React.useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function decide(requestId: string, decision: "approve" | "decline") {
    setChangingRequestId(requestId);
    setActionError("");
    try {
      const response = await authFetch(
        `/api/admin/access-requests/${encodeURIComponent(requestId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error === "access_invitation_failed"
            ? "The invitation could not be sent. The request remains pending."
            : payload?.error === "access_request_already_reviewed"
              ? "This request has already been reviewed."
              : "The access request could not be updated.",
        );
      }
      setConfirmation(null);
      await loadRequests();
    } catch (error: any) {
      setActionError(
        error?.message || "The access request could not be updated.",
      );
    } finally {
      setChangingRequestId("");
    }
  }

  if (access.role !== "owner") {
    return (
      <div className="rounded-xl border p-3">
        <div className="text-sm font-semibold">Access requests</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Only the Owner can approve new accounts.
        </div>
      </div>
    );
  }

  const pending = requests.filter((request) => request.status === "pending");
  const recent = requests
    .filter((request) => request.status !== "pending")
    .slice(0, 5);

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="border-b p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">Access requests</div>
              {pending.length ? (
                <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                  {pending.length}
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Approving a request emails a one-time Supabase invitation.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadRequests()}
            disabled={loading || Boolean(changingRequestId)}
            className="rounded-lg border px-2.5 py-1 text-xs disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-3 text-xs text-muted-foreground">
          Loading access requests…
        </div>
      ) : loadError ? (
        <div className="p-3 text-xs text-red-600">{loadError}</div>
      ) : pending.length === 0 ? (
        <div className="p-3 text-xs text-muted-foreground">
          No pending access requests.
        </div>
      ) : (
        <div className="divide-y">
          {pending.map((request) => {
            const isChanging = changingRequestId === request.id;
            const isConfirming = confirmation?.requestId === request.id;
            return (
              <div key={request.id} className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {request.requested_name || request.email}
                    </div>
                    {request.requested_name ? (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {request.email}
                      </div>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>
                        Requested {formatDate(request.last_requested_at)}
                      </span>
                      {request.request_count > 1 ? (
                        <span>Requested {request.request_count} times</span>
                      ) : null}
                    </div>
                    {request.request_message ? (
                      <div className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">
                        {request.request_message}
                      </div>
                    ) : null}
                  </div>
                  {!isConfirming ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmation({
                            requestId: request.id,
                            decision: "decline",
                          })
                        }
                        disabled={isChanging}
                        className="rounded-lg border px-2.5 py-1 text-xs disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmation({
                            requestId: request.id,
                            decision: "approve",
                          })
                        }
                        disabled={isChanging}
                        className="rounded-lg bg-foreground px-2.5 py-1 text-xs text-background disabled:opacity-50"
                      >
                        Approve
                      </button>
                    </div>
                  ) : null}
                </div>

                {isConfirming ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5">
                    <div className="text-xs">
                      {confirmation.decision === "approve"
                        ? `Send an account invitation to ${request.email}?`
                        : `Decline the request from ${request.email}?`}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmation(null)}
                        disabled={isChanging}
                        className="rounded-lg border px-2.5 py-1 text-xs disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void decide(request.id, confirmation.decision)
                        }
                        disabled={isChanging}
                        className="rounded-lg bg-foreground px-2.5 py-1 text-xs text-background disabled:opacity-50"
                      >
                        {isChanging
                          ? "Working…"
                          : confirmation.decision === "approve"
                            ? "Send Invitation"
                            : "Decline Request"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {actionError ? (
        <div className="border-t p-3 text-xs text-red-600">{actionError}</div>
      ) : null}

      {recent.length ? (
        <details className="border-t">
          <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">
            Recent decisions
          </summary>
          <div className="divide-y border-t">
            {recent.map((request) => (
              <div
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <span className="min-w-0 truncate">{request.email}</span>
                <span className="text-muted-foreground capitalize">
                  {request.status} · {formatDate(request.reviewed_at)}
                </span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
