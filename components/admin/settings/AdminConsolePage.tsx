"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";
import { AccessRequestsPanel } from "@/components/admin/settings/AccessRequestsPanel";
import { DevelopmentHistoryArchivePanel } from "@/components/admin/settings/DevelopmentHistoryArchivePanel";
import { AiOperationsPanel } from "@/components/admin/settings/AiOperationsPanel";
import { MemorySystemHealthPanel } from "@/components/admin/settings/MemorySystemHealthPanel";
import { MemoryWorkbenchPanel } from "@/components/admin/settings/MemoryWorkbenchPanel";
import { UsageAnalyticsPanel } from "@/components/admin/settings/UsageAnalyticsPanel";
import { VoiceSystemHealthPanel } from "@/components/admin/settings/VoiceSystemHealthPanel";
import { productTierLabel } from "@/lib/productEntitlements";

type AdminAccess = {
  user_id: string;
  role: "owner" | "admin";
  role_label: "Owner" | "Admin";
};

type AdminUser = {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  product_tier: "verbal_sage" | "lifeswitch" | "unassigned";
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
    }
  | {
      kind: "password-setup";
      userId: string;
      email: string;
    }
  | {
      kind: "product-tier";
      userId: string;
      productTier: "verbal_sage" | "lifeswitch";
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
  const [actionNotice, setActionNotice] = React.useState("");
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
    setActionNotice("");
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

  async function changeProductTier(
    userId: string,
    productTier: "verbal_sage" | "lifeswitch",
  ) {
    setChangingUserId(userId);
    setActionError("");
    setActionNotice("");
    try {
      const response = await authFetch(
        `/api/admin/users/${encodeURIComponent(userId)}/product-tier`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_tier: productTier }),
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error === "owner_product_tier_is_protected"
            ? "The Owner must retain LifeSwitch access."
            : "The product access could not be changed.",
        );
      }
      setConfirmation(null);
      setOpenActionsUserId("");
      await loadUsers();
    } catch (error: any) {
      setActionError(
        error?.message || "The product access could not be changed.",
      );
    } finally {
      setChangingUserId("");
    }
  }

  async function deleteAccount(userId: string, confirmationEmail: string) {
    setChangingUserId(userId);
    setActionError("");
    setActionNotice("");
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

  async function sendPasswordSetupEmail(userId: string, email: string) {
    setChangingUserId(userId);
    setActionError("");
    setActionNotice("");
    try {
      const response = await authFetch(
        `/api/admin/users/${encodeURIComponent(userId)}/password-setup`,
        {
          method: "POST",
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload?.sent) {
        throw new Error(
          payload?.error === "owner_account_is_protected"
            ? "The Owner account is protected."
            : "The password setup email could not be sent.",
        );
      }
      setConfirmation(null);
      setOpenActionsUserId("");
      setActionNotice(`Password setup email sent to ${email}.`);
    } catch (error: any) {
      setActionError(
        error?.message || "The password setup email could not be sent.",
      );
    } finally {
      setChangingUserId("");
    }
  }

  if (access.role !== "owner") {
    return (
      <div className="border-y border-muted/20 py-3">
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
          user.product_tier.includes(query) ||
          user.status.includes(query),
      )
    : users;

  return (
    <div>
      <div className="pb-3">
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
            className="px-1 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
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
        <div className="divide-y divide-muted/20 border-y border-muted/20">
          {filteredUsers.map((user) => {
            const nextRole = user.role === "admin" ? "member" : "admin";
            const nextProductTier =
              user.product_tier === "lifeswitch" ? "verbal_sage" : "lifeswitch";
            const isOwner = user.role === "owner";
            const isCurrentUser = user.id === access.user_id;
            const isRoleConfirming =
              confirmation?.kind === "role" &&
              confirmation?.userId === user.id &&
              confirmation.role === nextRole;
            const isDeleteConfirming =
              confirmation?.kind === "delete" &&
              confirmation.userId === user.id;
            const isPasswordSetupConfirming =
              confirmation?.kind === "password-setup" &&
              confirmation.userId === user.id;
            const isProductTierConfirming =
              confirmation?.kind === "product-tier" &&
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
                      <span>
                        Product: {productTierLabel(user.product_tier)}
                      </span>
                      {isCurrentUser ? <span>Current account</span> : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {productTierLabel(user.product_tier)}
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground capitalize">
                      {user.role}
                    </span>
                    {!isOwner ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActionError("");
                          setActionNotice("");
                          setConfirmation(null);
                          setDeleteConfirmationText("");
                          setOpenActionsUserId((current) =>
                            current === user.id ? "" : user.id,
                          );
                        }}
                        disabled={Boolean(changingUserId)}
                        aria-label={`Actions for ${user.email || "account"}`}
                        aria-expanded={isActionsOpen}
                        className="px-1.5 py-1 text-xs tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-50"
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
                          kind: "product-tier",
                          userId: user.id,
                          productTier: nextProductTier,
                        });
                        setOpenActionsUserId("");
                      }}
                      className="rounded-lg border px-2.5 py-1 text-xs"
                    >
                      {nextProductTier === "lifeswitch"
                        ? "Give LifeSwitch Access"
                        : "Set Verbal Sage Only"}
                    </button>
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
                          setConfirmation({
                            kind: "password-setup",
                            userId: user.id,
                            email: user.email,
                          });
                          setOpenActionsUserId("");
                        }}
                        className="rounded-lg border px-2.5 py-1 text-xs"
                      >
                        Send Password Setup Email
                      </button>
                    ) : null}
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

                {isProductTierConfirming ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5">
                    <div className="text-xs">
                      {confirmation.productTier === "lifeswitch"
                        ? "Give this account LifeSwitch plus Verbal Sage chat?"
                        : "Restrict this account to Verbal Sage chat only?"}
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
                          void changeProductTier(
                            user.id,
                            confirmation.productTier,
                          )
                        }
                        disabled={isChanging}
                        className="rounded-lg bg-foreground px-2.5 py-1 text-xs text-background disabled:opacity-50"
                      >
                        {isChanging ? "Saving…" : "Change Product Access"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {isPasswordSetupConfirming ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5">
                    <div className="text-xs">
                      Send a new one-time password setup code to{" "}
                      <span className="font-medium">{confirmation.email}</span>?
                      This does not change the account role or stored data.
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
                          void sendPasswordSetupEmail(
                            user.id,
                            confirmation.email,
                          )
                        }
                        disabled={isChanging}
                        className="rounded-lg bg-foreground px-2.5 py-1 text-xs text-background disabled:opacity-50"
                      >
                        {isChanging ? "Sending…" : "Send Setup Email"}
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
      {actionNotice ? (
        <div className="border-t p-3 text-xs">{actionNotice}</div>
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
  id,
  title,
  description,
  open,
  onToggle,
  children,
  mountWhenOpen = false,
}: {
  id: string;
  title: string;
  description?: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
  mountWhenOpen?: boolean;
}) {
  const panelId = `admin-section-${id}`;

  return (
    <section>
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-3 py-4 text-left hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onToggle(id)}
      >
        <span className="text-sm font-semibold">{title}</span>
        <span
          className={`shrink-0 text-xl text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
          aria-hidden="true"
        >
          ›
        </span>
      </button>
      {!mountWhenOpen || open ? (
        <div
          id={panelId}
          className="border-t border-muted/20 py-5"
          hidden={!open}
        >
          {description ? (
            <p className="mb-5 text-xs text-muted-foreground">{description}</p>
          ) : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function AdminConsolePage({ access }: { access: AdminAccess }) {
  const [inspectorEnabled, setInspectorEnabled] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [openSection, setOpenSection] = React.useState<string | null>(null);

  function toggleAdminSection(id: string) {
    setOpenSection((current) => (current === id ? null : id));
  }

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
    setStatus("Turning on response trace…");
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
      setStatus("Response trace is enabled for this browser.");
    } catch {
      setStatus("Response trace could not be enabled. Try again.");
    }
  }

  async function disableInspector() {
    setStatus("Turning off response trace…");
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
      setStatus("Response trace is disabled for this browser.");
    } catch {
      setStatus("Response trace could not be disabled. Try again.");
    }
  }

  return (
    <div className="divide-y divide-muted/20 border-y border-muted/20">
      <AdminSection
        id="voice-health"
        title="Voice Health"
        description="Current voice availability, latency, and retained reliability history."
        open={openSection === "voice-health"}
        onToggle={toggleAdminSection}
        mountWhenOpen
      >
        <VoiceSystemHealthPanel />
      </AdminSection>

      <AdminSection
        id="response-diagnostics"
        title="Response Diagnostics"
        description="Inspect governed response routing and execution details."
        open={openSection === "response-diagnostics"}
        onToggle={toggleAdminSection}
        mountWhenOpen
      >
        <div className="border-y border-muted/20 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Response trace</div>
              <div className="text-xs text-muted-foreground">
                Shows routing, model, safety, memory, token, and timing details
                for your chat replies in this browser. Authorization is checked
                on every request.
              </div>
            </div>

            <input
              type="checkbox"
              checked={inspectorEnabled}
              onChange={(event) => {
                if (event.target.checked) void enableInspector();
                else void disableInspector();
              }}
              aria-label="Enable response trace"
            />
          </div>

          {status ? (
            <div className="mt-2 text-xs text-muted-foreground">{status}</div>
          ) : null}
        </div>
      </AdminSection>

      <AdminSection
        id="ai-operations"
        title="AI Operations"
        description="Private reliability incidents from server-owned AI monitors."
        open={openSection === "ai-operations"}
        onToggle={toggleAdminSection}
        mountWhenOpen
      >
        <AiOperationsPanel />
      </AdminSection>

      <AdminSection
        id="usage-analytics"
        title="Usage & Analytics"
        description="Backend-authoritative AI consumption and LifeSwitch activity aggregates."
        open={openSection === "usage-analytics"}
        onToggle={toggleAdminSection}
        mountWhenOpen
      >
        <UsageAnalyticsPanel />
      </AdminSection>

      <AdminSection
        id="development-history"
        title="Development History Archive"
        description="Owner-only intake, provenance, privacy, and approval status for historical exports."
        open={openSection === "development-history"}
        onToggle={toggleAdminSection}
      >
        <DevelopmentHistoryArchivePanel access={access} />
      </AdminSection>

      <AdminSection
        id="users-access"
        title="Users & Access"
        description="Review account requests and manage administrative access."
        open={openSection === "users-access"}
        onToggle={toggleAdminSection}
      >
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3 border-y border-muted/20 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Your access</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Verified by the identity service for this session.
                </div>
              </div>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {access.role_label}
              </div>
            </div>
          </div>

          <AccessRequestsPanel access={access} />

          <UsersAccessPanel access={access} />

          <div className="grid border-y border-muted/20 text-xs sm:grid-cols-3 sm:divide-x sm:divide-muted/20">
            <div className="py-3 sm:px-3 sm:first:pl-0">
              <div className="font-semibold">Owner</div>
              <div className="mt-1 text-muted-foreground">
                Protected authority that appoints or removes Admins.
              </div>
            </div>
            <div className="border-t border-muted/20 py-3 sm:border-t-0 sm:px-3">
              <div className="font-semibold">Admin</div>
              <div className="mt-1 text-muted-foreground">
                Delegated access to administrative tools.
              </div>
            </div>
            <div className="border-t border-muted/20 py-3 sm:border-t-0 sm:px-3 sm:last:pr-0">
              <div className="font-semibold">Member</div>
              <div className="mt-1 text-muted-foreground">
                Standard product access without administration.
              </div>
            </div>
          </div>
        </div>
      </AdminSection>

      <AdminSection
        id="memory-health"
        title="Memory Health"
        description="Governed memory activity, synchronization, processing, and answer use."
        open={openSection === "memory-health"}
        onToggle={toggleAdminSection}
        mountWhenOpen
      >
        <MemorySystemHealthPanel />
      </AdminSection>

      <AdminSection
        id="memory-workbench"
        title="Memory Workbench"
        description="Review private GPU extraction results and record diagnostic feedback."
        open={openSection === "memory-workbench"}
        onToggle={toggleAdminSection}
        mountWhenOpen
      >
        <MemoryWorkbenchPanel />
      </AdminSection>
    </div>
  );
}
