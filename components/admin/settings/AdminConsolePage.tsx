"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";
import { AccessRequestsPanel } from "@/components/admin/settings/AccessRequestsPanel";
import { CardsPanel } from "@/components/admin/settings/CardsPanel";
import { MemoryReviewPanel } from "@/components/admin/settings/MemoryReviewPanel";
import { VoiceSystemHealthPanel } from "@/components/admin/settings/VoiceSystemHealthPanel";

type AdminAccess = {
  user_id: string;
  role: "owner" | "admin";
  role_label: "Owner" | "Admin";
};

type AdminUser = {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  status: "active" | "invited" | "unconfirmed" | "suspended";
  created_at: string | null;
  last_sign_in_at: string | null;
};

type AdminConfirmation =
  | {
      kind: "role";
      userId: string;
      role: "admin" | "member";
    }
  | {
      kind: "delete";
      userId: string;
      email: string;
    };

function formatAccountDate(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function UsersAccessPanel({ access }: { access: AdminAccess }) {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(access.role === "owner");
  const [loadError, setLoadError] = React.useState("");
  const [actionError, setActionError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [truncated, setTruncated] = React.useState(false);
  const [confirmation, setConfirmation] =
    React.useState<AdminConfirmation | null>(null);
  const [openActionsUserId, setOpenActionsUserId] = React.useState("");
  const [deleteConfirmationText, setDeleteConfirmationText] =
    React.useState("");
  const [changingUserId, setChangingUserId] = React.useState("");

  const loadUsers = React.useCallback(async () => {
    if (access.role !== "owner") return;
    setLoading(true);
    setLoadError("");
    try {
      const response = await authFetch("/api/admin/users", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !Array.isArray(payload.users)) {
        throw new Error(
          payload?.error === "owner_access_required"
            ? "Only the Owner can view the user directory."
            : "The user directory could not be loaded.",
        );
      }
      setUsers(payload.users);
      setTruncated(Boolean(payload.truncated));
    } catch (error: any) {
      setUsers([]);
      setLoadError(error?.message || "The user directory could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [access.role]);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function changeRole(userId: string, role: "admin" | "member") {
    setChangingUserId(userId);
    setActionError("");
    try {
      const response = await authFetch(
        `/api/admin/users/${encodeURIComponent(userId)}/role`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error === "owner_account_is_protected"
            ? "The Owner account cannot be changed."
            : "The administrator role could not be changed.",
        );
      }
      setConfirmation(null);
      setOpenActionsUserId("");
      await loadUsers();
    } catch (error: any) {
      setActionError(
        error?.message || "The administrator role could not be changed.",
      );
    } finally {
      setChangingUserId("");
    }
  }

  async function deleteAccount(userId: string, confirmationEmail: string) {
    setChangingUserId(userId);
    setActionError("");
    try {
      const response = await authFetch(
        `/api/admin/users/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation_email: confirmationEmail }),
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload?.deleted) {
        throw new Error(
          payload?.error === "owner_account_is_protected"
            ? "The Owner account cannot be deleted."
            : payload?.error === "confirmation_email_mismatch"
              ? "The confirmation email does not match."
              : "The account could not be deleted.",
        );
      }
      setConfirmation(null);
      setOpenActionsUserId("");
      setDeleteConfirmationText("");
      await loadUsers();
    } catch (error: any) {
      setActionError(error?.message || "The account could not be deleted.");
    } finally {
      setChangingUserId("");
    }
  }

  if (access.role !== "owner") {
    return (
      <div className="rounded-xl border p-3">
        <div className="text-sm font-semibold">Administrator management</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Only the Owner can appoint or remove administrators.
        </div>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const filteredUsers = query
    ? users.filter(
        (user) =>
          user.email.toLowerCase().includes(query) ||
          user.role.includes(query) ||
          user.status.includes(query),
      )
    : users;

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="border-b p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">
              Administrator management
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Appoint trusted administrators or return them to standard member
              access.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading || Boolean(changingUserId)}
            className="rounded-lg border px-2.5 py-1 text-xs disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        <label className="mt-3 block">
          <span className="sr-only">Search users</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users…"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      {loading ? (
        <div className="p-3 text-xs text-muted-foreground">Loading users…</div>
      ) : loadError ? (
        <div className="p-3 text-xs text-red-600">{loadError}</div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-3 text-xs text-muted-foreground">
          {query ? "No users match this search." : "No users found."}
        </div>
      ) : (
        <div className="divide-y">
          {filteredUsers.map((user) => {
            const nextRole = user.role === "admin" ? "member" : "admin";
            const isOwner = user.role === "owner";
            const isCurrentUser = user.id === access.user_id;
            const isRoleConfirming =
              confirmation?.kind === "role" &&
              confirmation?.userId === user.id &&
              confirmation.role === nextRole;
            const isDeleteConfirming =
              confirmation?.kind === "delete" &&
              confirmation.userId === user.id;
            const isChanging = changingUserId === user.id;
            const isActionsOpen = openActionsUserId === user.id;
            const deleteEmailMatches =
              Boolean(user.email) &&
              deleteConfirmationText.trim().toLowerCase() ===
                user.email.toLowerCase();

            return (
              <div key={user.id} className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {user.email || "Account without an email address"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>
                        {user.status.charAt(0).toUpperCase() +
                          user.status.slice(1)}
                      </span>
                      <span>
                        Last sign-in: {formatAccountDate(user.last_sign_in_at)}
                      </span>
                      {isCurrentUser ? <span>Current account</span> : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize">
                      {user.role}
                    </span>
                    {!isOwner ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActionError("");
                          setConfirmation(null);
                          setDeleteConfirmationText("");
                          setOpenActionsUserId((current) =>
                            current === user.id ? "" : user.id,
                          );
                        }}
                        disabled={Boolean(changingUserId)}
                        aria-label={`Actions for ${user.email || "account"}`}
                        aria-expanded={isActionsOpen}
                        className="rounded-lg border px-2.5 py-1 text-xs tracking-widest disabled:opacity-50"
                      >
                        •••
                      </button>
                    ) : null}
                  </div>
                </div>

                {isActionsOpen && !confirmation ? (
                  <div className="mt-3 flex flex-wrap justify-end gap-2 rounded-lg border bg-muted/20 p-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmation({
                          kind: "role",
                          userId: user.id,
                          role: nextRole,
                        });
                        setOpenActionsUserId("");
                      }}
                      className="rounded-lg border px-2.5 py-1 text-xs"
                    >
                      {user.role === "admin" ? "Remove Admin" : "Make Admin"}
                    </button>
                    {user.email ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirmationText("");
                          setConfirmation({
                            kind: "delete",
                            userId: user.id,
                            email: user.email,
                          });
                          setOpenActionsUserId("");
                        }}
                        className="rounded-lg border border-red-600/50 px-2.5 py-1 text-xs text-red-600"
                      >
                        Delete Account
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {isRoleConfirming ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5">
                    <div className="text-xs">
                      {nextRole === "admin"
                        ? "Give this account access to administrative tools?"
                        : "Remove this account’s administrative access?"}
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
                        onClick={() => void changeRole(user.id, nextRole)}
                        disabled={isChanging}
                        className="rounded-lg bg-foreground px-2.5 py-1 text-xs text-background disabled:opacity-50"
                      >
                        {isChanging
                          ? "Saving…"
                          : nextRole === "admin"
                            ? "Make Admin"
                            : "Remove Admin"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {isDeleteConfirming ? (
                  <div className="mt-3 rounded-lg border border-red-600/40 bg-red-600/5 p-3">
                    <div className="text-sm font-semibold text-red-600">
                      Delete account
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      This permanently removes the Supabase login for{" "}
                      <span className="font-medium text-foreground">
                        {user.email}
                      </span>
                      . Conversations and memory data are not deleted.
                    </div>
                    <label className="mt-3 block">
                      <span className="text-xs">
                        Type the account email to confirm
                      </span>
                      <input
                        type="email"
                        value={deleteConfirmationText}
                        onChange={(event) =>
                          setDeleteConfirmationText(event.target.value)
                        }
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmation(null);
                          setDeleteConfirmationText("");
                        }}
                        disabled={isChanging}
                        className="rounded-lg border px-2.5 py-1 text-xs disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void deleteAccount(
                            user.id,
                            deleteConfirmationText.trim(),
                          )
                        }
                        disabled={!deleteEmailMatches || isChanging}
                        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs text-white disabled:opacity-40"
                      >
                        {isChanging ? "Deleting…" : "Delete Account"}
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
      {truncated ? (
        <div className="border-t p-3 text-xs text-muted-foreground">
          Showing the first 100 accounts.
        </div>
      ) : null}
    </div>
  );
}

function AdminSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="overflow-hidden rounded-xl border">
      <summary className="cursor-pointer list-none px-3 py-3 hover:bg-muted/40">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{title}</div>
            {description ? (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </div>
            ) : null}
          </div>
          <div className="shrink-0 rounded-lg border px-2 py-0.5 text-xs text-muted-foreground">
            Open
          </div>
        </div>
      </summary>
      <div className="border-t p-3">{children}</div>
    </details>
  );
}

export function AdminConsolePage({ access }: { access: AdminAccess }) {
  const [inspectorEnabled, setInspectorEnabled] = React.useState(false);
  const [status, setStatus] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await authFetch("/api/admin/debug_cookie", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!cancelled) {
          setInspectorEnabled(Boolean(response.ok && payload?.enabled));
        }
      } catch {
        if (!cancelled) setInspectorEnabled(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function enableInspector() {
    setStatus("enabling…");
    try {
      const response = await authFetch("/api/admin/debug_cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });
      const text = await response.text().catch(() => "");
      if (!response.ok) {
        throw new Error(text || `HTTP ${response.status}`);
      }
      setInspectorEnabled(true);
      setStatus("enabled");
    } catch (error: any) {
      setStatus(`error: ${error?.message || String(error)}`);
    }
  }

  async function disableInspector() {
    setStatus("disabling…");
    try {
      const response = await authFetch("/api/admin/debug_cookie", {
        method: "DELETE",
        credentials: "same-origin",
      });
      const text = await response.text().catch(() => "");
      if (!response.ok) {
        throw new Error(text || `HTTP ${response.status}`);
      }
      setInspectorEnabled(false);
      setStatus("disabled");
    } catch (error: any) {
      setStatus(`error: ${error?.message || String(error)}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/20 p-3">
        <div className="text-sm font-semibold">Administration</div>
        <div className="mt-1 text-xs text-muted-foreground">
          System tools, user access, and memory evaluation.
        </div>
      </div>

      <AdminSection
        title="System Tools"
        description="System health and protected prompt inspection."
      >
        <div className="space-y-3">
          <VoiceSystemHealthPanel />

          <div className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Prompt Inspector</div>
                <div className="text-xs text-muted-foreground">
                  Enables prompt inspection for this browser. Authorization is
                  checked on every request.
                </div>
              </div>

              <input
                type="checkbox"
                checked={inspectorEnabled}
                onChange={(event) => {
                  if (event.target.checked) void enableInspector();
                  else void disableInspector();
                }}
                aria-label="Enable Prompt Inspector"
              />
            </div>

            {status ? (
              <div className="mt-2 text-xs text-muted-foreground">{status}</div>
            ) : null}
          </div>
        </div>
      </AdminSection>

      <AdminSection
        title="Users & Access"
        description="Review account requests and manage administrative access."
      >
        <div className="space-y-3">
          <div className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Your access</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Verified by the identity service for this session.
                </div>
              </div>
              <div className="rounded-full border px-2.5 py-1 text-xs font-semibold">
                {access.role_label}
              </div>
            </div>
          </div>

          <AccessRequestsPanel access={access} />

          <UsersAccessPanel access={access} />

          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-xl border p-3">
              <div className="font-semibold">Owner</div>
              <div className="mt-1 text-muted-foreground">
                Protected authority that appoints or removes Admins.
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="font-semibold">Admin</div>
              <div className="mt-1 text-muted-foreground">
                Delegated access to administrative tools.
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="font-semibold">Member</div>
              <div className="mt-1 text-muted-foreground">
                Standard product access without administration.
              </div>
            </div>
          </div>
        </div>
      </AdminSection>

      <AdminSection
        title="Memory / Retrieval Evaluation"
        description="Memory status, card inspection, and the future retrieval/prompt-injection evaluator."
      >
        <div className="space-y-3">
          <div className="rounded-xl border p-3">
            <div className="text-sm font-semibold">Memory System Status</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Backend route audit now checks card policy metadata, retrieval
              plans, profile-card gating, specific recall, and user isolation.
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Goal: inspect what is active, style-only, content-eligible,
              retired, or never allowed to surface.
            </div>
          </div>

          <MemoryReviewPanel />

          <div className="rounded-xl border p-3">
            <div className="text-sm font-semibold">Memory Inspector</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Existing memory/card inspector. The new memory evaluator should be
              added in this section, not as another top-level Admin block.
            </div>
            <div className="mt-3">
              <CardsPanel />
            </div>
          </div>
        </div>
      </AdminSection>
    </div>
  );
}
