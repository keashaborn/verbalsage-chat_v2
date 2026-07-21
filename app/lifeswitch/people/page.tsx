"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { supabase } from "@/lib/supabaseClient";

type PersonProfile = {
  user_id: string;
  display_name: string;
  email?: string | null;
  is_active?: boolean;
};

type Relationship = {
  relationship_id: string;
  requester_user_id: string;
  addressee_user_id: string;
  other_user_id: string;
  status: "pending" | "accepted" | "blocked" | "revoked";
  relationship_kind: "friend" | "training_partner" | "plan_helper" | "coach";
  label: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

type RelationshipPermission = {
  relationship_permission_id: string;
  relationship_id: string;
  grantor_user_id?: string | null;
  grantee_user_id?: string | null;
  permission_scope: PermissionScope;
  permission_level: PermissionLevel;
  is_enabled: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};

type Invitation = {
  invitation_id: string;
  created_by_user_id: string;
  creator_display_name?: string;
  accepted_by_user_id?: string | null;
  accepted_display_name?: string | null;
  relationship_kind: Relationship["relationship_kind"];
  label: string;
  notes: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
  updated_at: string;
};

type CreatedInvitation = Invitation & {
  token: string;
};

type WorkoutTemplateShare = {
  workout_template_share_id: string;
  created_by_user_id: string;
  workout_template_id: string;
  workout_name?: string | null;
  status: "active" | "revoked" | "expired";
  label?: string | null;
  notes?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
  updated_at: string;
};

type PermissionScope =
  | "messages:send"
  | "training:view"
  | "nutrition:view"
  | "measurements:view"
  | "plan:view"
  | "plan:comment"
  | "plan:edit";

type PermissionLevel = "none" | "view" | "comment" | "edit" | "admin";
type NetworkTab = "connections" | "invites" | "sharing";

const PERMISSIONS: Array<{
  scope: PermissionScope;
  label: string;
  level: PermissionLevel;
  description: string;
}> = [
  {
    scope: "messages:send",
    label: "Messages",
    level: "comment",
    description: "Allow private LifeSwitch messages.",
  },
  {
    scope: "training:view",
    label: "Training view",
    level: "view",
    description:
      "Allow viewing shared training logs and related training context.",
  },
  {
    scope: "nutrition:view",
    label: "Nutrition view",
    level: "view",
    description:
      "Allow viewing shared nutrition logs and related nutrition context.",
  },
  {
    scope: "measurements:view",
    label: "Measurements view",
    level: "view",
    description: "Allow viewing shared measurements and body-composition data.",
  },
  {
    scope: "plan:view",
    label: "Plan view",
    level: "view",
    description: "Allow viewing the shared unified LifeSwitch plan.",
  },
  {
    scope: "plan:comment",
    label: "Plan comment",
    level: "comment",
    description: "Allow comments and suggestions on the shared plan.",
  },
  {
    scope: "plan:edit",
    label: "Plan edit",
    level: "edit",
    description:
      "Allow drafting and proposing shared Plan changes. The owner must still approve before activation.",
  },
];

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await authFetch(url, { cache: "no-store", ...(init || {}) });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(text || `HTTP ${r.status}`);
  }
  return (await r.json()) as T;
}

function shortId(id: string | null | undefined): string {
  if (!id) return "unknown";
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function displayName(
  person: PersonProfile | null | undefined,
  fallbackId?: string | null,
): string {
  const clean = String(person?.display_name || "").trim();
  return clean || `User ${shortId(fallbackId || person?.user_id)}`;
}

function statusBadge(status?: string): string {
  if (!status) return "not connected";
  return status.replaceAll("_", " ");
}

function kindLabel(kind?: string): string {
  if (!kind) return "friend";
  return kind.replaceAll("_", " ");
}

export default function LifeSwitchPeoplePage() {
  const [currentUserId, setCurrentUserId] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<NetworkTab>("connections");
  const [people, setPeople] = React.useState<PersonProfile[]>([]);
  const [relationships, setRelationships] = React.useState<Relationship[]>([]);
  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [selectedKind, setSelectedKind] =
    React.useState<Relationship["relationship_kind"]>("friend");
  const [permissions, setPermissions] = React.useState<
    RelationshipPermission[]
  >([]);
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [workoutShares, setWorkoutShares] = React.useState<
    WorkoutTemplateShare[]
  >([]);
  const [inviteKind, setInviteKind] =
    React.useState<Relationship["relationship_kind"]>("friend");
  const [inviteLabel, setInviteLabel] = React.useState("");
  const [lastInviteLink, setLastInviteLink] = React.useState("");
  const [copyMessage, setCopyMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [openInviteActionsId, setOpenInviteActionsId] = React.useState("");
  const [relationshipActionsOpen, setRelationshipActionsOpen] =
    React.useState(false);
  const [removingRelationshipId, setRemovingRelationshipId] =
    React.useState("");
  const [error, setError] = React.useState("");

  const currentPerson = people.find((p) => p.user_id === currentUserId) || null;
  const acceptedContacts = React.useMemo(
    () =>
      relationships
        .filter((relationship) => relationship.status === "accepted")
        .map((relationship) => ({
          relationship,
          person:
            people.find(
              (person) => person.user_id === relationship.other_user_id,
            ) ||
            ({
              user_id: relationship.other_user_id,
              display_name: relationship.label || "",
            } satisfies PersonProfile),
        })),
    [people, relationships],
  );
  const selectedContact =
    acceptedContacts.find(({ person }) => person.user_id === selectedUserId) ||
    null;
  const selectedPerson = selectedContact?.person || null;
  const selectedRelationship = selectedContact?.relationship || null;

  const permissionsIGive = React.useMemo(
    () =>
      permissions.filter(
        (p) => !currentUserId || p.grantor_user_id === currentUserId,
      ),
    [permissions, currentUserId],
  );

  const permissionByScope = React.useMemo(() => {
    const m = new Map<PermissionScope, RelationshipPermission>();
    for (const p of permissionsIGive) m.set(p.permission_scope, p);
    return m;
  }, [permissionsIGive]);

  async function loadAll(nextSelectedUserId?: string) {
    setLoading(true);
    setError("");
    try {
      const [relationshipRows, inviteRows, shareRows] = await Promise.all([
        fetchJson<Relationship[]>("/api/lifeswitch/people/relationships"),
        fetchJson<Invitation[]>("/api/lifeswitch/people/invitations"),
        fetchJson<WorkoutTemplateShare[]>(
          "/api/lifeswitch/training/workout_template_shares?include_inactive=1",
        ),
      ]);

      const profileIds = Array.from(
        new Set(
          [
            currentUserId,
            ...relationshipRows
              .filter((relationship) => relationship.status === "accepted")
              .map((relationship) => relationship.other_user_id),
          ].filter(Boolean),
        ),
      );
      const profileRows = profileIds.length
        ? await fetchJson<PersonProfile[]>(
            `/api/lifeswitch/people/profiles?user_ids=${encodeURIComponent(profileIds.join(","))}`,
          )
        : [];

      setPeople(profileRows);
      setRelationships(relationshipRows);
      setInvitations(Array.isArray(inviteRows) ? inviteRows : []);
      setWorkoutShares(Array.isArray(shareRows) ? shareRows : []);

      const requestedNext =
        nextSelectedUserId !== undefined ? nextSelectedUserId : selectedUserId;
      const rel = requestedNext
        ? relationshipRows.find(
            (relationship) =>
              relationship.other_user_id === requestedNext &&
              relationship.status === "accepted",
          )
        : null;
      const next = rel ? requestedNext : "";

      setSelectedUserId(next);
      if (rel) {
        setSelectedKind(rel.relationship_kind);
        await loadPermissions(rel.relationship_id);
      } else {
        setSelectedKind("friend");
        setPermissions([]);
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }

  async function loadPermissions(relationshipId: string) {
    if (!relationshipId) {
      setPermissions([]);
      return;
    }

    const rows = await fetchJson<RelationshipPermission[]>(
      `/api/lifeswitch/people/relationships/${encodeURIComponent(relationshipId)}/permissions`,
    );
    setPermissions(rows);
  }

  async function selectPerson(userId: string) {
    setRelationshipActionsOpen(false);
    setSelectedUserId(userId);
    const rel = relationships.find(
      (relationship) =>
        relationship.other_user_id === userId &&
        relationship.status === "accepted",
    );
    if (rel) {
      setSelectedKind(rel.relationship_kind);
      await loadPermissions(rel.relationship_id);
    } else {
      setSelectedKind("friend");
      setPermissions([]);
    }
  }

  function buildInviteLink(token: string): string {
    if (typeof window === "undefined")
      return `/invite/lifeswitch/${encodeURIComponent(token)}`;
    return `${window.location.origin}/invite/lifeswitch/${encodeURIComponent(token)}`;
  }

  async function createInviteLink() {
    setSaving(true);
    setError("");
    setCopyMessage("");

    try {
      const created = await fetchJson<CreatedInvitation>(
        "/api/lifeswitch/people/invitations/create",
        {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            relationship_kind: inviteKind,
            label: inviteLabel,
            notes: "Created from LifeSwitch People invite link.",
          }),
        },
      );

      const link = buildInviteLink(created.token);
      setLastInviteLink(link);
      setInviteLabel("");
      await loadAll(selectedUserId);

      try {
        await navigator.clipboard.writeText(link);
        setCopyMessage("Invite link created and copied.");
      } catch {
        setCopyMessage("Invite link created. Copy it below.");
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  }

  async function copyInviteLink(link: string) {
    setCopyMessage("");
    try {
      await navigator.clipboard.writeText(link);
      setCopyMessage("Copied.");
    } catch {
      setCopyMessage("Could not copy automatically.");
    }
  }

  async function revokeInvite(invitationId: string) {
    const invite = invitations.find(
      (inv) => inv.invitation_id === invitationId,
    );
    const label =
      invite?.label || kindLabel(invite?.relationship_kind || "friend");
    const ok = window.confirm(
      `Revoke invite "${label}"? The link will stop working immediately.`,
    );
    if (!ok) return;

    setSaving(true);
    setError("");
    try {
      await fetchJson(
        `/api/lifeswitch/people/invitations/${encodeURIComponent(invitationId)}/revoke`,
        {
          method: "POST",
        },
      );
      setOpenInviteActionsId("");
      await loadAll(selectedUserId);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  }

  async function saveRelationship() {
    if (
      !selectedRelationship ||
      selectedRelationship.status !== "accepted" ||
      !selectedUserId
    ) {
      setError("Only an accepted connection can be updated.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const person = people.find((p) => p.user_id === selectedUserId);
      const rel = await fetchJson<Relationship>(
        "/api/lifeswitch/people/relationships/upsert",
        {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            other_user_id: selectedUserId,
            status: "accepted",
            relationship_kind: selectedKind,
            label: person?.display_name || "",
            notes: "Managed from LifeSwitch People.",
          }),
        },
      );

      await loadAll(rel.other_user_id);
      await loadPermissions(rel.relationship_id);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!selectedRelationship || !selectedPerson) return;

    const name = displayName(selectedPerson, selectedUserId);
    const ok = window.confirm(
      `Disconnect from "${name}"? New messages and shared access will stop. Existing messages remain available as read-only history.`,
    );
    if (!ok) return;

    setRemovingRelationshipId(selectedRelationship.relationship_id);
    setError("");
    try {
      await fetchJson<Relationship>(
        `/api/lifeswitch/people/relationships/${encodeURIComponent(
          selectedRelationship.relationship_id,
        )}/revoke`,
        { method: "POST" },
      );
      setRelationshipActionsOpen(false);
      setSelectedUserId("");
      setSelectedKind("friend");
      setPermissions([]);
      await loadAll("");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setRemovingRelationshipId("");
    }
  }

  async function setPermission(
    scope: PermissionScope,
    level: PermissionLevel,
    enabled: boolean,
  ) {
    if (!selectedRelationship) return;

    setSaving(true);
    setError("");
    try {
      await fetchJson<RelationshipPermission>(
        `/api/lifeswitch/people/relationships/${encodeURIComponent(
          selectedRelationship.relationship_id,
        )}/permissions/upsert`,
        {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            permission_scope: scope,
            permission_level: enabled ? level : "none",
            is_enabled: enabled ? 1 : 0,
            notes: "Managed from LifeSwitch People permissions UI.",
          }),
        },
      );

      await loadPermissions(selectedRelationship.relationship_id);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  }

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setCurrentUserId(data?.user?.id || "");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  return (
    <div className="grid gap-4">
      <div
        className={
          selectedPerson
            ? "hidden flex-col gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between"
            : "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        }
      >
        <div>
          <div className="text-lg font-semibold">Contacts</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Manage your LifeSwitch connections for messages, workout sharing,
            and permissioned plan help.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("connections")}
            className={[
              "rounded-full border px-3 py-1.5 text-sm",
              activeTab === "connections" ? "bg-muted/40" : "hover:bg-muted/30",
            ].join(" ")}
          >
            Connections
          </button>

          <Link
            href="/lifeswitch/people/messages"
            className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted/30"
          >
            Messages
          </Link>

          <button
            type="button"
            onClick={() => setActiveTab("invites")}
            className={[
              "rounded-full border px-3 py-1.5 text-sm",
              activeTab === "invites" ? "bg-muted/40" : "hover:bg-muted/30",
            ].join(" ")}
          >
            Invites
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sharing")}
            className={[
              "rounded-full border px-3 py-1.5 text-sm",
              activeTab === "sharing" ? "bg-muted/40" : "hover:bg-muted/30",
            ].join(" ")}
          >
            Sharing
          </button>
          <Link
            href="/lifeswitch/people/helping"
            className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted/30"
          >
            Viewing
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section
        className={activeTab === "invites" ? "rounded-xl border" : "hidden"}
      >
        <div className="border-b px-4 py-3">
          <div className="text-sm font-semibold">Invite link</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Create a connection-only invite link. Send it by text, email, or
            LifeSwitch message.
          </div>
        </div>

        <div className="grid gap-3 p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
            <input
              value={inviteLabel}
              onChange={(e) => setInviteLabel(e.target.value)}
              placeholder="Person name or label"
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
            <select
              value={inviteKind}
              onChange={(e) =>
                setInviteKind(
                  e.target.value as Relationship["relationship_kind"],
                )
              }
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="friend">Friend</option>
              <option value="training_partner">Training partner</option>
              <option value="plan_helper">Plan helper</option>
              <option value="coach">Coach</option>
            </select>
            <button
              type="button"
              onClick={() => void createInviteLink()}
              disabled={saving}
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
            >
              Create link
            </button>
          </div>

          {lastInviteLink ? (
            <div className="grid gap-2 rounded-xl border bg-muted/10 p-3">
              <div className="text-xs font-medium text-muted-foreground">
                Latest invite link
              </div>
              <div className="text-sm break-all">{lastInviteLink}</div>
              <div>
                <button
                  type="button"
                  onClick={() => void copyInviteLink(lastInviteLink)}
                  className="rounded-md border px-3 py-2 text-xs hover:bg-muted/30"
                >
                  Copy link
                </button>
              </div>
            </div>
          ) : null}

          {copyMessage ? (
            <div className="text-xs text-muted-foreground">{copyMessage}</div>
          ) : null}

          <div className="rounded-xl border">
            <div className="border-b px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Pending invites
            </div>
            <div className="grid">
              {invitations.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  No pending invites.
                </div>
              ) : (
                invitations.map((inv) => (
                  <div
                    key={inv.invitation_id}
                    className="grid gap-2 border-b p-3 last:border-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">
                          {inv.label?.trim() || "Unnamed invite"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {kindLabel(inv.relationship_kind)} · {inv.status}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Created{" "}
                          {inv.created_at
                            ? new Date(inv.created_at).toLocaleString()
                            : ""}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setOpenInviteActionsId((prev) =>
                            prev === inv.invitation_id ? "" : inv.invitation_id,
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30"
                        aria-expanded={
                          openInviteActionsId === inv.invitation_id
                        }
                      >
                        Actions
                        {openInviteActionsId === inv.invitation_id ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Expires{" "}
                      {inv.expires_at
                        ? new Date(inv.expires_at).toLocaleDateString()
                        : "later"}
                    </div>

                    {openInviteActionsId === inv.invitation_id ? (
                      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                        <div className="text-[11px] font-semibold tracking-wide text-red-500 uppercase">
                          Danger zone
                        </div>
                        <button
                          type="button"
                          onClick={() => void revokeInvite(inv.invitation_id)}
                          disabled={saving}
                          className="mt-2 inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          Revoke invite
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section
        className={activeTab === "sharing" ? "rounded-xl border" : "hidden"}
      >
        <div className="border-b px-4 py-3">
          <div className="text-sm font-semibold">Shared workout templates</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Share links you created from Training Workouts. Links are copied
            when created; this list lets you review them.
          </div>
        </div>

        <div className="grid">
          {workoutShares.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No workout template shares yet. Create one from Training Workouts.
            </div>
          ) : (
            workoutShares.map((share) => {
              const title =
                share.label?.trim() || share.workout_name || "Shared workout";

              return (
                <div
                  key={share.workout_template_share_id}
                  className="grid gap-2 border-b p-3 last:border-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {title}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {share.workout_name && share.workout_name !== title
                          ? `${share.workout_name} · `
                          : ""}
                        {share.status}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Created{" "}
                        {share.created_at
                          ? new Date(share.created_at).toLocaleString()
                          : ""}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Expires{" "}
                        {share.expires_at
                          ? new Date(share.expires_at).toLocaleDateString()
                          : "later"}
                      </div>
                    </div>

                    <Link
                      href="/lifeswitch/training/design/workouts"
                      className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30"
                    >
                      Workouts
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <div
        className={
          activeTab === "connections"
            ? selectedPerson
              ? "grid gap-4 lg:grid-cols-[340px_1fr]"
              : "grid gap-4"
            : "hidden"
        }
      >
        <section
          className={
            selectedPerson
              ? "hidden rounded-xl border lg:block"
              : "rounded-xl border"
          }
        >
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Users className="h-4 w-4" />
            <div className="text-sm font-semibold">Contacts</div>
          </div>

          <div className="grid max-h-[620px] overflow-auto">
            {acceptedContacts.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                {loading ? "Loading connections…" : "No accepted connections."}
              </div>
            ) : (
              acceptedContacts.map(({ person, relationship: rel }) => {
                const active = person.user_id === selectedUserId;

                return (
                  <button
                    key={person.user_id}
                    type="button"
                    onClick={() => void selectPerson(person.user_id)}
                    className={[
                      "border-b px-4 py-3 text-left hover:bg-muted/30",
                      active ? "bg-muted/20" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {displayName(person)}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {person.email || shortId(person.user_id)}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-full border px-2 py-1 text-[10px] tracking-wide text-muted-foreground uppercase">
                        {statusBadge(rel?.status)}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {kindLabel(rel.relationship_kind)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className={selectedPerson ? "grid gap-4" : "hidden"}>
          <div className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {selectedPerson
                    ? displayName(selectedPerson)
                    : "Select a person"}
                </div>
                <div className="mt-1 text-xs break-all text-muted-foreground">
                  {selectedPerson
                    ? selectedPerson.user_id
                    : "Choose someone from the list."}
                </div>
              </div>

              {selectedPerson ? (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRelationshipActionsOpen(false);
                      setSelectedUserId("");
                      setSelectedKind("friend");
                      setPermissions([]);
                    }}
                    className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30"
                  >
                    <span className="lg:hidden">← Contacts</span>
                    <span className="hidden lg:inline">Close</span>
                  </button>

                  {selectedRelationship ? (
                    <button
                      type="button"
                      onClick={() =>
                        setRelationshipActionsOpen((open) => !open)
                      }
                      aria-expanded={relationshipActionsOpen}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30"
                    >
                      Actions
                      {relationshipActionsOpen ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {selectedRelationship && relationshipActionsOpen ? (
              <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 p-3">
                <div className="text-xs font-semibold text-red-500">
                  Disconnect
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Stop new messages and revoke shared access. Existing messages
                  remain available as read-only history.
                </div>
                <button
                  type="button"
                  onClick={() => void disconnect()}
                  disabled={Boolean(removingRelationshipId)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-500/40 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {removingRelationshipId ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            ) : null}

            {selectedPerson ? (
              <details className="mt-4 rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  Relationship details
                </summary>

                <div className="mt-3 grid gap-3">
                  <div className="grid gap-2 sm:grid-cols-[220px_1fr_auto]">
                    <select
                      value={selectedKind}
                      onChange={(e) =>
                        setSelectedKind(
                          e.target.value as Relationship["relationship_kind"],
                        )
                      }
                      className="rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="friend">Friend</option>
                      <option value="training_partner">Training partner</option>
                      <option value="plan_helper">Plan helper</option>
                      <option value="coach">Coach</option>
                    </select>

                    <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                      Status: {statusBadge(selectedRelationship?.status)}
                    </div>

                    <button
                      type="button"
                      onClick={() => void saveRelationship()}
                      disabled={saving || !selectedRelationship}
                      className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                    >
                      Update
                    </button>
                  </div>

                  {selectedRelationship ? (
                    <div className="text-xs text-muted-foreground">
                      relationship_id: {selectedRelationship.relationship_id}
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}
          </div>

          <div className="rounded-xl border">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <ShieldCheck className="h-4 w-4" />
              <div>
                <div className="text-sm font-semibold">
                  Access you give {displayName(selectedPerson, selectedUserId)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Control what this person can see or do in{" "}
                  {displayName(currentPerson, currentUserId)}’s LifeSwitch.
                </div>
              </div>
            </div>

            <div className="grid gap-2 p-4">
              {!selectedRelationship ? (
                <div className="text-sm text-muted-foreground">
                  Select an accepted connection.
                </div>
              ) : (
                <>
                  {PERMISSIONS.map((p) => {
                    const existing = permissionByScope.get(p.scope);
                    const enabled = Boolean(existing?.is_enabled);

                    return (
                      <div
                        key={p.scope}
                        className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto]"
                      >
                        <div>
                          <div className="text-sm font-semibold">{p.label}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {p.description}
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {p.scope} · level:{" "}
                            {enabled
                              ? existing?.permission_level || p.level
                              : "none"}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void setPermission(p.scope, p.level, !enabled)
                          }
                          disabled={saving}
                          className={[
                            "rounded-md border px-3 py-2 text-sm disabled:opacity-50",
                            enabled ? "bg-muted/30" : "hover:bg-muted/30",
                          ].join(" ")}
                        >
                          {enabled ? "Turn off" : "Turn on"}
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
