"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  LockKeyhole,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Share2,
  ShieldCheck,
  Trash2,
  Utensils,
  Users,
} from "lucide-react";
import { useConfirmAction } from "@/components/lifeswitch/ConfirmActionProvider";
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

type PermissionDefinition = {
  scope: PermissionScope;
  label: string;
  level: PermissionLevel;
  description: string;
};

const PERMISSIONS: PermissionDefinition[] = [
  {
    scope: "messages:send",
    label: "Messages",
    level: "comment",
    description: "Allow private LifeSwitch messages.",
  },
  {
    scope: "training:view",
    label: "Training history",
    level: "view",
    description:
      "View completed sessions, the training calendar, and exercise history.",
  },
  {
    scope: "nutrition:view",
    label: "Nutrition log",
    level: "view",
    description: "View logged foods, meals, totals, and nutrition history.",
  },
  {
    scope: "measurements:view",
    label: "Measurements",
    level: "view",
    description: "View measurements and body-composition history.",
  },
  {
    scope: "plan:view",
    label: "View Plan",
    level: "view",
    description: "Allow viewing the shared unified LifeSwitch plan.",
  },
  {
    scope: "plan:comment",
    label: "Comment on Plan",
    level: "comment",
    description:
      "Allow comments and suggestions. This also allows viewing the shared Plan.",
  },
  {
    scope: "plan:edit",
    label: "Draft Plan changes",
    level: "edit",
    description:
      "Allow drafting and proposing changes. This also allows viewing; the owner must still approve activation.",
  },
];

const PERMISSION_GROUPS: Array<{
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  scopes: PermissionScope[];
  sensitive?: boolean;
}> = [
  {
    key: "communication",
    label: "Communication",
    description: "Private communication inside LifeSwitch.",
    icon: MessageSquare,
    scopes: ["messages:send"],
  },
  {
    key: "training",
    label: "Training",
    description: "Read-only access to your completed training.",
    icon: Dumbbell,
    scopes: ["training:view"],
  },
  {
    key: "plan",
    label: "Plan collaboration",
    description: "View, discuss, or draft changes to your Plan.",
    icon: ClipboardList,
    scopes: ["plan:view", "plan:comment", "plan:edit"],
  },
  {
    key: "health",
    label: "Health data",
    description: "Sensitive nutrition and body-measurement records.",
    icon: LockKeyhole,
    scopes: ["nutrition:view", "measurements:view"],
    sensitive: true,
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
  const confirmAction = useConfirmAction();
  const [currentUserId, setCurrentUserId] = React.useState("");
  const currentUserIdRef = React.useRef("");
  const [authResolved, setAuthResolved] = React.useState(false);
  const [invitePanelOpen, setInvitePanelOpen] = React.useState(false);
  const [people, setPeople] = React.useState<PersonProfile[]>([]);
  const [relationships, setRelationships] = React.useState<Relationship[]>([]);
  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [selectedKind, setSelectedKind] =
    React.useState<Relationship["relationship_kind"]>("friend");
  const [permissions, setPermissions] = React.useState<
    RelationshipPermission[]
  >([]);
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [inviteKind, setInviteKind] =
    React.useState<Relationship["relationship_kind"]>("friend");
  const [inviteLabel, setInviteLabel] = React.useState("");
  const [lastInviteLink, setLastInviteLink] = React.useState("");
  const [copyMessage, setCopyMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [loadingPermissions, setLoadingPermissions] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [openInviteActionsId, setOpenInviteActionsId] = React.useState("");
  const [relationshipActionsOpen, setRelationshipActionsOpen] =
    React.useState(false);
  const [removingRelationshipId, setRemovingRelationshipId] =
    React.useState("");
  const [error, setError] = React.useState("");
  const loadAllRequestRef = React.useRef(0);
  const permissionsRequestRef = React.useRef(0);
  const selectedUserIdRef = React.useRef("");
  const selectedRelationshipIdRef = React.useRef("");
  const contactSelectionVersionRef = React.useRef(0);
  const authContextVersionRef = React.useRef(0);
  const mutationRequestRef = React.useRef(0);

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
  const canMutate = authResolved && Boolean(currentUserId);

  const permissionsIGive = React.useMemo(
    () => permissions.filter((p) => p.grantor_user_id === currentUserId),
    [permissions, currentUserId],
  );

  const permissionByScope = React.useMemo(() => {
    const m = new Map<PermissionScope, RelationshipPermission>();
    for (const p of permissionsIGive) m.set(p.permission_scope, p);
    return m;
  }, [permissionsIGive]);

  const permissionsTheyGive = React.useMemo(
    () =>
      permissions.filter(
        (p) =>
          p.grantor_user_id === selectedUserId &&
          p.grantee_user_id === currentUserId &&
          p.is_enabled,
      ),
    [permissions, selectedUserId, currentUserId],
  );

  const permissionTheyGiveByScope = React.useMemo(() => {
    const m = new Map<PermissionScope, RelationshipPermission>();
    for (const p of permissionsTheyGive) m.set(p.permission_scope, p);
    return m;
  }, [permissionsTheyGive]);

  const pendingInvitations = React.useMemo(
    () => invitations.filter((invitation) => invitation.status === "pending"),
    [invitations],
  );

  function clearSelectedContact() {
    contactSelectionVersionRef.current += 1;
    permissionsRequestRef.current += 1;
    selectedUserIdRef.current = "";
    selectedRelationshipIdRef.current = "";
    setSelectedUserId("");
    setSelectedKind("friend");
    setPermissions([]);
    setLoadingPermissions(false);
    setRelationshipActionsOpen(false);
  }

  function clearSensitiveInviteState() {
    setLastInviteLink("");
    setCopyMessage("");
    setOpenInviteActionsId("");
  }

  function clearUserScopedState() {
    authContextVersionRef.current += 1;
    loadAllRequestRef.current += 1;
    permissionsRequestRef.current += 1;
    mutationRequestRef.current += 1;
    setPeople([]);
    setRelationships([]);
    setInvitations([]);
    clearSelectedContact();
    clearSensitiveInviteState();
    setInviteLabel("");
    setSaving(false);
    setRemovingRelationshipId("");
    setLoading(false);
    setLoadingPermissions(false);
    setError("");
  }

  async function loadAll(nextSelectedUserId?: string) {
    const requestId = ++loadAllRequestRef.current;
    const selectionVersionAtStart = contactSelectionVersionRef.current;
    if (!currentUserId) {
      clearUserScopedState();
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [relationshipRows, inviteRows] = await Promise.all([
        fetchJson<Relationship[]>("/api/lifeswitch/people/relationships"),
        fetchJson<Invitation[]>("/api/lifeswitch/people/invitations"),
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

      if (requestId !== loadAllRequestRef.current) return;

      setPeople(profileRows);
      setRelationships(relationshipRows);
      setInvitations(Array.isArray(inviteRows) ? inviteRows : []);

      const selectionChanged =
        contactSelectionVersionRef.current !== selectionVersionAtStart;
      const requestedNext =
        !selectionChanged && nextSelectedUserId !== undefined
          ? nextSelectedUserId
          : selectedUserIdRef.current;
      const rel = requestedNext
        ? relationshipRows.find(
            (relationship) =>
              relationship.other_user_id === requestedNext &&
              relationship.status === "accepted",
          )
        : null;
      const next = rel ? requestedNext : "";

      selectedUserIdRef.current = next;
      setSelectedUserId(next);
      if (rel) {
        selectedRelationshipIdRef.current = rel.relationship_id;
        setSelectedKind(rel.relationship_kind);
        setPermissions([]);
        await loadPermissions(rel.relationship_id);
      } else {
        clearSelectedContact();
      }
    } catch (e) {
      if (requestId !== loadAllRequestRef.current) return;
      clearUserScopedState();
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      if (requestId === loadAllRequestRef.current) setLoading(false);
    }
  }

  async function loadPermissions(relationshipId: string) {
    const requestId = ++permissionsRequestRef.current;
    setPermissions([]);

    if (
      !relationshipId ||
      selectedRelationshipIdRef.current !== relationshipId
    ) {
      setLoadingPermissions(false);
      return;
    }

    setLoadingPermissions(true);
    try {
      const rows = await fetchJson<RelationshipPermission[]>(
        `/api/lifeswitch/people/relationships/${encodeURIComponent(relationshipId)}/permissions`,
      );
      if (
        requestId !== permissionsRequestRef.current ||
        selectedRelationshipIdRef.current !== relationshipId
      ) {
        return;
      }
      setPermissions(rows);
    } catch (e) {
      if (
        requestId !== permissionsRequestRef.current ||
        selectedRelationshipIdRef.current !== relationshipId
      ) {
        return;
      }
      setPermissions([]);
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      if (
        requestId === permissionsRequestRef.current &&
        selectedRelationshipIdRef.current === relationshipId
      ) {
        setLoadingPermissions(false);
      }
    }
  }

  async function selectPerson(userId: string) {
    const rel = relationships.find(
      (relationship) =>
        relationship.other_user_id === userId &&
        relationship.status === "accepted",
    );
    if (!rel) {
      clearSelectedContact();
      return;
    }

    setRelationshipActionsOpen(false);
    contactSelectionVersionRef.current += 1;
    selectedUserIdRef.current = userId;
    selectedRelationshipIdRef.current = rel.relationship_id;
    setSelectedUserId(userId);
    setSelectedKind(rel.relationship_kind);
    setPermissions([]);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    await loadPermissions(rel.relationship_id);
  }

  function buildInviteLink(token: string): string {
    if (typeof window === "undefined")
      return `/invite/lifeswitch/${encodeURIComponent(token)}`;
    return `${window.location.origin}/invite/lifeswitch/${encodeURIComponent(token)}`;
  }

  async function createInviteLink() {
    if (!canMutate) {
      setError("Your signed-in session is not ready.");
      return;
    }
    const authContextAtStart = authContextVersionRef.current;
    const mutationRequestId = ++mutationRequestRef.current;
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

      if (authContextVersionRef.current !== authContextAtStart) return;

      const link = buildInviteLink(created.token);
      setLastInviteLink(link);
      setInviteLabel("");
      await loadAll(selectedUserIdRef.current);

      if (authContextVersionRef.current !== authContextAtStart) return;

      try {
        await navigator.clipboard.writeText(link);
        if (authContextVersionRef.current === authContextAtStart) {
          setCopyMessage("Invite link created and copied.");
        }
      } catch {
        if (authContextVersionRef.current === authContextAtStart) {
          setCopyMessage("Invite link created. Copy it below.");
        }
      }
    } catch (e) {
      if (authContextVersionRef.current === authContextAtStart) {
        setError(String(e instanceof Error ? e.message : e));
      }
    } finally {
      if (mutationRequestId === mutationRequestRef.current) {
        setSaving(false);
      }
    }
  }

  async function copyInviteLink(link: string) {
    if (!canMutate) return;
    const authContextAtStart = authContextVersionRef.current;
    setCopyMessage("");
    try {
      await navigator.clipboard.writeText(link);
      if (authContextVersionRef.current === authContextAtStart) {
        setCopyMessage("Copied.");
      }
    } catch {
      if (authContextVersionRef.current === authContextAtStart) {
        setCopyMessage("Could not copy automatically.");
      }
    }
  }

  async function shareInviteLink(link: string) {
    if (!canMutate) return;
    setCopyMessage("");

    if (typeof navigator.share !== "function") {
      await copyInviteLink(link);
      setCopyMessage(
        "Sharing is not available in this browser. Link copied instead.",
      );
      return;
    }

    try {
      await navigator.share({
        title: "Join me on LifeSwitch",
        text: "Use this private invitation to connect with me on LifeSwitch.",
        url: link,
      });
      setCopyMessage("Invite shared.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setCopyMessage("Could not open sharing. You can copy the link instead.");
    }
  }

  async function revokeInvite(invitationId: string) {
    if (!canMutate) {
      setError("Your signed-in session is not ready.");
      return;
    }
    const authContextAtStart = authContextVersionRef.current;
    const invite = invitations.find(
      (inv) => inv.invitation_id === invitationId,
    );
    const label =
      invite?.label || kindLabel(invite?.relationship_kind || "friend");
    const confirmed = await confirmAction({
      title: `Revoke invite “${label}”?`,
      description: "The invitation link will stop working immediately.",
      confirmLabel: "Revoke invite",
    });
    if (!confirmed) return;
    const mutationRequestId = ++mutationRequestRef.current;

    setSaving(true);
    setError("");
    try {
      await fetchJson(
        `/api/lifeswitch/people/invitations/${encodeURIComponent(invitationId)}/revoke`,
        {
          method: "POST",
        },
      );
      if (authContextVersionRef.current !== authContextAtStart) return;
      setOpenInviteActionsId("");
      await loadAll(selectedUserIdRef.current);
    } catch (e) {
      if (authContextVersionRef.current === authContextAtStart) {
        setError(String(e instanceof Error ? e.message : e));
      }
    } finally {
      if (mutationRequestId === mutationRequestRef.current) {
        setSaving(false);
      }
    }
  }

  async function saveRelationship() {
    if (!canMutate) {
      setError("Your signed-in session is not ready.");
      return;
    }
    if (
      !selectedRelationship ||
      selectedRelationship.status !== "accepted" ||
      !selectedUserId
    ) {
      setError("Only an accepted connection can be updated.");
      return;
    }

    const targetUserId = selectedUserId;
    const targetRelationshipId = selectedRelationship.relationship_id;
    const authContextAtStart = authContextVersionRef.current;
    const mutationRequestId = ++mutationRequestRef.current;
    setSaving(true);
    setError("");
    try {
      const person = people.find((p) => p.user_id === targetUserId);
      await fetchJson<Relationship>(
        "/api/lifeswitch/people/relationships/upsert",
        {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            other_user_id: targetUserId,
            status: "accepted",
            relationship_kind: selectedKind,
            label: person?.display_name || "",
            notes: "Managed from LifeSwitch People.",
          }),
        },
      );

      if (authContextVersionRef.current !== authContextAtStart) return;

      if (
        selectedUserIdRef.current === targetUserId &&
        selectedRelationshipIdRef.current === targetRelationshipId
      ) {
        await loadAll(targetUserId);
      } else {
        await loadAll(selectedUserIdRef.current);
      }
    } catch (e) {
      if (authContextVersionRef.current === authContextAtStart) {
        setError(String(e instanceof Error ? e.message : e));
      }
    } finally {
      if (mutationRequestId === mutationRequestRef.current) {
        setSaving(false);
      }
    }
  }

  async function disconnect() {
    if (!canMutate) {
      setError("Your signed-in session is not ready.");
      return;
    }
    if (!selectedRelationship || !selectedPerson) return;

    const relationshipId = selectedRelationship.relationship_id;
    const authContextAtStart = authContextVersionRef.current;
    const name = displayName(selectedPerson, selectedUserId);
    const confirmed = await confirmAction({
      title: `Disconnect from ${name}?`,
      description:
        "New messages and shared access will stop. Existing messages remain available as read-only history.",
      confirmLabel: "Disconnect",
    });
    if (!confirmed) return;
    const mutationRequestId = ++mutationRequestRef.current;

    setRemovingRelationshipId(selectedRelationship.relationship_id);
    setError("");
    try {
      await fetchJson<Relationship>(
        `/api/lifeswitch/people/relationships/${encodeURIComponent(
          relationshipId,
        )}/revoke`,
        { method: "POST" },
      );
      if (authContextVersionRef.current !== authContextAtStart) return;
      if (selectedRelationshipIdRef.current === relationshipId) {
        clearSelectedContact();
      }
      await loadAll(selectedUserIdRef.current);
    } catch (e) {
      if (authContextVersionRef.current === authContextAtStart) {
        setError(String(e instanceof Error ? e.message : e));
      }
    } finally {
      if (mutationRequestId === mutationRequestRef.current) {
        setRemovingRelationshipId("");
      }
    }
  }

  async function setPermission(
    scope: PermissionScope,
    level: PermissionLevel,
    enabled: boolean,
  ) {
    if (!canMutate) {
      setError("Your signed-in session is not ready.");
      return;
    }
    if (!selectedRelationship || loadingPermissions) return;

    const relationshipId = selectedRelationship.relationship_id;
    const authContextAtStart = authContextVersionRef.current;
    if (selectedRelationshipIdRef.current !== relationshipId) return;
    const mutationRequestId = ++mutationRequestRef.current;

    setSaving(true);
    setError("");
    try {
      await fetchJson<RelationshipPermission>(
        `/api/lifeswitch/people/relationships/${encodeURIComponent(
          relationshipId,
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

      if (authContextVersionRef.current !== authContextAtStart) return;

      if (selectedRelationshipIdRef.current === relationshipId) {
        await loadPermissions(relationshipId);
      }
    } catch (e) {
      if (authContextVersionRef.current === authContextAtStart) {
        setError(String(e instanceof Error ? e.message : e));
      }
    } finally {
      if (mutationRequestId === mutationRequestRef.current) {
        setSaving(false);
      }
    }
  }

  React.useEffect(() => {
    let cancelled = false;
    let authGeneration = 0;

    void (async () => {
      const generation = authGeneration;
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!cancelled && generation === authGeneration) {
          const userId = data?.user?.id || "";
          currentUserIdRef.current = userId;
          setCurrentUserId(userId);
        }
      } catch (e) {
        if (!cancelled && generation === authGeneration) {
          clearUserScopedState();
          currentUserIdRef.current = "";
          setCurrentUserId("");
        }
      } finally {
        if (!cancelled && generation === authGeneration) {
          setAuthResolved(true);
        }
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || event === "INITIAL_SESSION") return;
      authGeneration += 1;
      const nextUserId = session?.user?.id || "";
      if (currentUserIdRef.current === nextUserId) {
        setAuthResolved(true);
        return;
      }
      clearUserScopedState();
      currentUserIdRef.current = nextUserId;
      setCurrentUserId(nextUserId);
      setAuthResolved(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (!authResolved) return;
    if (!currentUserId) {
      clearUserScopedState();
      return;
    }
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authResolved, currentUserId]);

  return (
    <div className="grid gap-4 pt-1 sm:pt-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-2xl font-semibold">People</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Connect, message, and control exactly what each person can access.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/lifeswitch/people/messages"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
          >
            <MessageSquare className="h-4 w-4" />
            Messages
          </Link>

          <button
            type="button"
            onClick={() => setInvitePanelOpen((open) => !open)}
            aria-expanded={invitePanelOpen}
            className={[
              "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
              invitePanelOpen ? "bg-muted/40" : "hover:bg-muted/30",
            ].join(" ")}
          >
            <Plus className="h-4 w-4" />
            Invite someone
            {pendingInvitations.length ? (
              <span className="text-[10px] text-muted-foreground">
                · {pendingInvitations.length}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {invitePanelOpen ? (
        <section className="border-y">
          <div className="flex items-start justify-between gap-3 border-b py-3">
            <div>
              <div className="text-sm font-semibold">Invite someone</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Create a private, expiring connection link and send it with
                Mail, Messages, or another sharing app.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInvitePanelOpen(false)}
              className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30"
            >
              Close
            </button>
          </div>

          <div className="grid gap-3 py-4">
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
                disabled={saving || !canMutate}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
              >
                Create link
              </button>
            </div>

            <div className="text-xs text-muted-foreground">
              The relationship label is descriptive. It never grants training,
              Plan, nutrition, or measurement access automatically.
            </div>

            {lastInviteLink ? (
              <div className="grid gap-2 border-l-2 border-foreground/30 py-1 pl-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Latest invite link
                </div>
                <div className="text-sm break-all">{lastInviteLink}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void shareInviteLink(lastInviteLink)}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-muted/30"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share invite
                  </button>
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

            <div className="border-t">
              <div className="border-b py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Pending invites
              </div>
              <div className="grid">
                {pendingInvitations.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    No pending invites.
                  </div>
                ) : (
                  pendingInvitations.map((inv) => (
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
                              prev === inv.invitation_id
                                ? ""
                                : inv.invitation_id,
                            )
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          aria-expanded={
                            openInviteActionsId === inv.invitation_id
                          }
                          aria-label={`Actions for ${inv.label || "invite"}`}
                          title={`Actions for ${inv.label || "invite"}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Expires{" "}
                        {inv.expires_at
                          ? new Date(inv.expires_at).toLocaleDateString()
                          : "later"}
                      </div>

                      {openInviteActionsId === inv.invitation_id ? (
                        <div className="rounded-lg border bg-background p-1 shadow-sm">
                          <button
                            type="button"
                            onClick={() => void revokeInvite(inv.invitation_id)}
                            disabled={saving || !canMutate}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50"
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
      ) : null}

      <div
        className={
          selectedPerson ? "grid gap-4 lg:grid-cols-[340px_1fr]" : "grid gap-4"
        }
      >
        <section
          className={selectedPerson ? "hidden border-y lg:block" : "border-y"}
        >
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Users className="h-4 w-4" />
            <div className="text-sm font-semibold">Connections</div>
            <div className="ml-auto text-xs text-muted-foreground">
              {acceptedContacts.length}
            </div>
          </div>

          <div className="grid max-h-[620px] overflow-auto">
            {acceptedContacts.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                {loading ? "Loading connections…" : "No accepted connections."}
                {!loading ? (
                  <button
                    type="button"
                    onClick={() => setInvitePanelOpen(true)}
                    className="mt-3 block rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
                  >
                    Invite someone
                  </button>
                ) : null}
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
                      active
                        ? "border-l-2 border-l-foreground bg-muted/10"
                        : "",
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
                      <div className="shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
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
          <div className="border-b pb-4">
            <div className="grid gap-3 sm:flex sm:items-start sm:justify-between">
              <div className="min-w-0 sm:flex-1">
                <div className="text-sm font-semibold [overflow-wrap:anywhere]">
                  {selectedPerson
                    ? displayName(selectedPerson)
                    : "Select a person"}
                </div>
                <div className="mt-1 text-xs [overflow-wrap:anywhere] text-muted-foreground">
                  {selectedPerson
                    ? selectedPerson.email ||
                      kindLabel(selectedRelationship?.relationship_kind)
                    : "Choose someone from the list."}
                </div>
              </div>

              {selectedPerson ? (
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                  {permissionTheyGiveByScope.has("messages:send") ? (
                    <Link
                      href="/lifeswitch/people/messages"
                      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs hover:bg-muted/30"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Message
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={clearSelectedContact}
                    className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30"
                  >
                    <span className="lg:hidden">← People</span>
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
              <div className="mt-3 border-y border-red-500/30 py-3">
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
                  disabled={Boolean(removingRelationshipId) || !canMutate}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-500/40 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {removingRelationshipId ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            ) : null}

            {selectedPerson ? (
              <details className="mt-4 border-t pt-3">
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

                    <div className="px-1 py-2 text-sm text-muted-foreground">
                      Status: {statusBadge(selectedRelationship?.status)}
                    </div>

                    <button
                      type="button"
                      onClick={() => void saveRelationship()}
                      disabled={saving || !selectedRelationship || !canMutate}
                      className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                    >
                      Update
                    </button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    This label helps organize the relationship. Access remains
                    separately controlled below.
                  </div>
                </div>
              </details>
            ) : null}
          </div>

          <div className="border-b pb-4">
            <div className="flex items-center gap-2 py-3">
              <ShieldCheck className="h-4 w-4" />
              <div>
                <div className="text-sm font-semibold">
                  What {displayName(selectedPerson, selectedUserId)} shares with
                  you
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Open only the LifeSwitch areas this person has explicitly
                  shared.
                </div>
              </div>
            </div>

            <div className="pt-1">
              {loadingPermissions ? (
                <div className="text-sm text-muted-foreground">
                  Loading access…
                </div>
              ) : permissionsTheyGive.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  This person has not shared any LifeSwitch data with you.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {permissionTheyGiveByScope.has("messages:send") ? (
                    <Link
                      href="/lifeswitch/people/messages"
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
                    >
                      <MessageSquare className="h-4 w-4" /> Message
                    </Link>
                  ) : null}
                  {permissionTheyGiveByScope.has("training:view") ? (
                    <Link
                      href={`/lifeswitch/training/calendar?target_user_id=${encodeURIComponent(selectedUserId)}&target_name=${encodeURIComponent(displayName(selectedPerson, selectedUserId))}`}
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
                    >
                      <Dumbbell className="h-4 w-4" /> View training
                    </Link>
                  ) : null}
                  {permissionTheyGiveByScope.has("plan:view") ? (
                    <Link
                      href={`/lifeswitch/plan?target_user_id=${encodeURIComponent(selectedUserId)}&target_name=${encodeURIComponent(displayName(selectedPerson, selectedUserId))}`}
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
                    >
                      <ClipboardList className="h-4 w-4" /> View Plan
                    </Link>
                  ) : null}
                  {permissionTheyGiveByScope.has("nutrition:view") ? (
                    <Link
                      href={`/lifeswitch/nutrition/log?target_user_id=${encodeURIComponent(selectedUserId)}&target_name=${encodeURIComponent(displayName(selectedPerson, selectedUserId))}`}
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
                    >
                      <Utensils className="h-4 w-4" /> View nutrition
                    </Link>
                  ) : null}
                  {permissionTheyGiveByScope.has("measurements:view") ? (
                    <Link
                      href={`/lifeswitch/measurements/log?target_user_id=${encodeURIComponent(selectedUserId)}&target_name=${encodeURIComponent(displayName(selectedPerson, selectedUserId))}`}
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
                    >
                      <Activity className="h-4 w-4" /> View measurements
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 py-3">
              <ShieldCheck className="h-4 w-4" />
              <div>
                <div className="text-sm font-semibold">
                  Access you give {displayName(selectedPerson, selectedUserId)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Every request is checked against your verified identity and
                  this directional access grant.
                </div>
              </div>
            </div>

            <div className="grid gap-4 pt-1">
              {!selectedRelationship ? (
                <div className="text-sm text-muted-foreground">
                  Select an accepted connection.
                </div>
              ) : loadingPermissions ? (
                <div className="text-sm text-muted-foreground">
                  Loading permissions…
                </div>
              ) : (
                PERMISSION_GROUPS.map((group) => {
                  const GroupIcon = group.icon;
                  const groupPermissions = group.scopes
                    .map((scope) =>
                      PERMISSIONS.find((item) => item.scope === scope),
                    )
                    .filter((item): item is PermissionDefinition =>
                      Boolean(item),
                    );
                  const permissionRows = (
                    <div className="divide-y border-y">
                      {groupPermissions.map((p) => {
                        const existing = permissionByScope.get(p.scope);
                        const enabled = Boolean(existing?.is_enabled);

                        return (
                          <div
                            key={p.scope}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold">
                                {p.label}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {p.description}
                              </div>
                            </div>

                            <div className="grid min-w-[7.5rem] justify-items-end gap-1">
                              <div className="text-[11px] text-muted-foreground">
                                Currently {enabled ? "allowed" : "not allowed"}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  void setPermission(p.scope, p.level, !enabled)
                                }
                                disabled={
                                  saving || loadingPermissions || !canMutate
                                }
                                aria-label={`${
                                  enabled ? "Remove" : "Allow"
                                } ${p.label} access`}
                                className={[
                                  "min-w-[7.5rem] rounded-md border px-3 py-2 text-xs disabled:opacity-50 sm:text-sm",
                                  enabled
                                    ? "hover:bg-muted/30"
                                    : "bg-muted/40 hover:bg-muted/60",
                                ].join(" ")}
                              >
                                {enabled ? "Remove access" : "Allow access"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );

                  if (group.sensitive) {
                    return (
                      <details
                        key={group.key}
                        className="border-y border-amber-500/25"
                      >
                        <summary className="cursor-pointer list-none py-3 [&::-webkit-details-marker]:hidden">
                          <div className="flex items-center gap-2">
                            <GroupIcon className="h-4 w-4 text-amber-500" />
                            <div>
                              <div className="text-sm font-semibold">
                                {group.label}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {group.description} Off unless you explicitly
                                allow it.
                              </div>
                            </div>
                          </div>
                        </summary>
                        <div className="border-t pt-3">{permissionRows}</div>
                      </details>
                    );
                  }

                  return (
                    <div key={group.key} className="grid gap-3 border-t pt-4">
                      <div className="flex items-center gap-2">
                        <GroupIcon className="h-4 w-4" />
                        <div>
                          <div className="text-sm font-semibold">
                            {group.label}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {group.description}
                          </div>
                        </div>
                      </div>
                      {permissionRows}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
