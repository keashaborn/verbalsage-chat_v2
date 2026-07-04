"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, MessageSquare, RefreshCw, ShieldCheck, Trash2, UserRoundCheck, Users } from "lucide-react";
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
    description: "Allow viewing shared training logs and related training context.",
  },
  {
    scope: "nutrition:view",
    label: "Nutrition view",
    level: "view",
    description: "Allow viewing shared nutrition logs and related nutrition context.",
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
    description: "Allow direct shared plan editing. Use cautiously.",
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

function displayName(person: PersonProfile | null | undefined, fallbackId?: string | null): string {
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
  const [selectedKind, setSelectedKind] = React.useState<Relationship["relationship_kind"]>("friend");
  const [permissions, setPermissions] = React.useState<RelationshipPermission[]>([]);
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [inviteKind, setInviteKind] = React.useState<Relationship["relationship_kind"]>("friend");
  const [inviteLabel, setInviteLabel] = React.useState("");
  const [lastInviteLink, setLastInviteLink] = React.useState("");
  const [copyMessage, setCopyMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [openInviteActionsId, setOpenInviteActionsId] = React.useState("");
  const [error, setError] = React.useState("");

  const visiblePeople = React.useMemo(
    () => people.filter((p) => !currentUserId || p.user_id !== currentUserId),
    [people, currentUserId]
  );

  const currentPerson = people.find((p) => p.user_id === currentUserId) || null;
  const selectedPerson = visiblePeople.find((p) => p.user_id === selectedUserId) || null;
  const selectedRelationship =
    relationships.find((r) => r.other_user_id === selectedUserId) || null;

  const permissionsIGive = React.useMemo(
    () => permissions.filter((p) => !currentUserId || p.grantor_user_id === currentUserId),
    [permissions, currentUserId]
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
      const [profileRows, relationshipRows, inviteRows] = await Promise.all([
        fetchJson<PersonProfile[]>("/api/lifeswitch/people/profiles"),
        fetchJson<Relationship[]>("/api/lifeswitch/people/relationships"),
        fetchJson<Invitation[]>("/api/lifeswitch/people/invitations"),
      ]);

      setPeople(profileRows);
      setRelationships(relationshipRows);
      setInvitations(Array.isArray(inviteRows) ? inviteRows : []);

      const next = nextSelectedUserId || selectedUserId || "";

      setSelectedUserId(next);

      const rel = next ? relationshipRows.find((r) => r.other_user_id === next) : null;
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
      `/api/lifeswitch/people/relationships/${encodeURIComponent(relationshipId)}/permissions`
    );
    setPermissions(rows);
  }

  async function selectPerson(userId: string) {
    setSelectedUserId(userId);
    const rel = relationships.find((r) => r.other_user_id === userId);
    if (rel) {
      setSelectedKind(rel.relationship_kind);
      await loadPermissions(rel.relationship_id);
    } else {
      setSelectedKind("friend");
      setPermissions([]);
    }
  }

  function buildInviteLink(token: string): string {
    if (typeof window === "undefined") return `/invite/lifeswitch/${encodeURIComponent(token)}`;
    return `${window.location.origin}/invite/lifeswitch/${encodeURIComponent(token)}`;
  }

  async function createInviteLink() {
    setSaving(true);
    setError("");
    setCopyMessage("");

    try {
      const created = await fetchJson<CreatedInvitation>("/api/lifeswitch/people/invitations/create", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          relationship_kind: inviteKind,
          label: inviteLabel,
          notes: "Created from LifeSwitch People invite link.",
        }),
      });

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
    const invite = invitations.find((inv) => inv.invitation_id === invitationId);
    const label = invite?.label || kindLabel(invite?.relationship_kind || "friend");
    const ok = window.confirm(`Revoke invite "${label}"? The link will stop working immediately.`);
    if (!ok) return;

    setSaving(true);
    setError("");
    try {
      await fetchJson(`/api/lifeswitch/people/invitations/${encodeURIComponent(invitationId)}/revoke`, {
        method: "POST",
      });
      setOpenInviteActionsId("");
      await loadAll(selectedUserId);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  }

  async function saveRelationship() {
    if (!selectedUserId) return;
    if (currentUserId && selectedUserId === currentUserId) {
      setError("You cannot create a relationship with yourself.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const person = people.find((p) => p.user_id === selectedUserId);
      const rel = await fetchJson<Relationship>("/api/lifeswitch/people/relationships/upsert", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          other_user_id: selectedUserId,
          status: "accepted",
          relationship_kind: selectedKind,
          label: person?.display_name || "",
          notes: "Managed from LifeSwitch People.",
        }),
      });

      await loadAll(rel.other_user_id);
      await loadPermissions(rel.relationship_id);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  }

  async function setPermission(scope: PermissionScope, level: PermissionLevel, enabled: boolean) {
    if (!selectedRelationship) return;

    setSaving(true);
    setError("");
    try {
      await fetchJson<RelationshipPermission>(
        `/api/lifeswitch/people/relationships/${encodeURIComponent(
          selectedRelationship.relationship_id
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
        }
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-semibold">Network</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Build your LifeSwitch support network for messages, workout sharing, and permissioned plan help.
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

      <section className={activeTab === "invites" ? "rounded-xl border" : "hidden"}>
        <div className="border-b px-4 py-3">
          <div className="text-sm font-semibold">Invite link</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Create a connection-only invite link. Send it by text, email, or LifeSwitch message.
          </div>
        </div>

        <div className="grid gap-3 p-4">
          <div className="grid gap-2 sm:grid-cols-[220px_1fr_auto]">
            <select
              value={inviteKind}
              onChange={(e) => setInviteKind(e.target.value as Relationship["relationship_kind"])}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="friend">Friend</option>
              <option value="training_partner">Training partner</option>
              <option value="plan_helper">Plan helper</option>
              <option value="coach">Coach</option>
            </select>

            <input
              value={inviteLabel}
              onChange={(e) => setInviteLabel(e.target.value)}
              placeholder="Optional label"
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />

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
              <div className="text-xs font-medium text-muted-foreground">Latest invite link</div>
              <div className="break-all text-sm">{lastInviteLink}</div>
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
              <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pending invites
              </div>
              <div className="grid">
                {invitations.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No pending invites.</div>
                ) : (
                  invitations.map((inv) => (
                    <div key={inv.invitation_id} className="grid gap-2 border-b p-3 last:border-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{kindLabel(inv.relationship_kind)}</div>
                          <div className="text-xs text-muted-foreground">
                            Created {inv.created_at ? new Date(inv.created_at).toLocaleString() : ""}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenInviteActionsId((prev) =>
                              prev === inv.invitation_id ? "" : inv.invitation_id
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30"
                          aria-expanded={openInviteActionsId === inv.invitation_id}
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
                        Expires {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "later"}
                      </div>

                      {openInviteActionsId === inv.invitation_id ? (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-red-500">
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

      <div className={selectedPerson ? "grid gap-4 lg:grid-cols-[340px_1fr]" : "grid gap-4"}>
        <section className="rounded-xl border">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Users className="h-4 w-4" />
            <div className="text-sm font-semibold">Known people</div>
          </div>

          <div className="grid max-h-[620px] overflow-auto">
            {visiblePeople.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                {loading ? "Loading people…" : "No people found."}
              </div>
            ) : (
              visiblePeople.map((person) => {
                const rel = relationships.find((r) => r.other_user_id === person.user_id);
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
                        <div className="truncate text-sm font-semibold">{displayName(person)}</div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {person.email || shortId(person.user_id)}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {statusBadge(rel?.status)}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {rel ? kindLabel(rel.relationship_kind) : "No relationship yet"}
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
                  {selectedPerson ? displayName(selectedPerson) : "Select a person"}
                </div>
                <div className="mt-1 break-all text-xs text-muted-foreground">
                  {selectedPerson ? selectedPerson.user_id : "Choose someone from the list."}
                </div>
              </div>

              {selectedPerson ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUserId("");
                    setSelectedKind("friend");
                    setPermissions([]);
                  }}
                  className="shrink-0 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30"
                >
                  Close
                </button>
              ) : null}
            </div>

            {selectedPerson ? (
              <div className="mt-4 grid gap-3">
                <div className="grid gap-2 sm:grid-cols-[220px_1fr_auto]">
                  <select
                    value={selectedKind}
                    onChange={(e) =>
                      setSelectedKind(e.target.value as Relationship["relationship_kind"])
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
                    disabled={saving}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                  >
                    {selectedRelationship ? "Update" : "Create"}
                  </button>
                </div>

                {selectedRelationship ? (
                  <div className="text-xs text-muted-foreground">
                    relationship_id: {selectedRelationship.relationship_id}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Create a relationship before assigning permissions.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <ShieldCheck className="h-4 w-4" />
              <div>
                <div className="text-sm font-semibold">Access I give this person</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  These controls grant the selected person access to your LifeSwitch data. They do not give you access to their data.
                </div>
              </div>
            </div>

            <div className="grid gap-2 p-4">
              {!selectedRelationship ? (
                <div className="text-sm text-muted-foreground">
                  Select a person with a relationship, or create one above.
                </div>
              ) : (
                <>
                  <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                    You are granting{" "}
                    <span className="font-semibold">{displayName(selectedPerson, selectedUserId)}</span>{" "}
                    access to{" "}
                    <span className="font-semibold">{displayName(currentPerson, currentUserId)}</span>
                    ’s LifeSwitch data. Only permissions granted by the current logged-in account are shown here.
                  </div>

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
                        <div className="mt-1 text-xs text-muted-foreground">{p.description}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {p.scope} · level: {enabled ? existing?.permission_level || p.level : "none"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void setPermission(p.scope, p.level, !enabled)}
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
