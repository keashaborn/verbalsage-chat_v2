"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import BackButton from "@/components/nav/BackButton";
import { authFetch } from "@/lib/authFetch";
import { supabase } from "@/lib/supabaseClient";

type Conversation = {
  conversation_id: string;
  conversation_kind: string;
  created_by_user_id: string;
  title: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  other_user_id: string | null;
  other_display_name?: string | null;
  can_send?: boolean;
  last_message_id: string | null;
  last_message_author_user_id: string | null;
  last_message_body: string | null;
  last_message_created_at: string | null;
};

type Message = {
  message_id: string;
  conversation_id: string;
  author_user_id: string;
  author_display_name?: string | null;
  body: string;
  body_format: string;
  metadata: Record<string, unknown>;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

type PersonProfile = {
  user_id: string;
  display_name: string;
  email?: string | null;
  is_active?: boolean;
};

type Relationship = {
  relationship_id: string;
  other_user_id: string;
  status: "pending" | "accepted" | "blocked" | "revoked";
  relationship_kind: "friend" | "training_partner" | "plan_helper" | "coach";
  label: string;
};

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

function formatTime(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function displayUserName(
  name: string | null | undefined,
  id: string | null | undefined,
): string {
  const clean = String(name || "").trim();
  return clean || `User ${shortId(id)}`;
}

function renderMessageBody(body: string) {
  const text = String(body || "");
  const re =
    /(https?:\/\/[^\s]+|\/share\/workout\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;

    if (start > last) {
      parts.push(text.slice(last, start));
    }

    const href = raw.startsWith("/") ? raw : raw;
    const label = raw;

    parts.push(
      <a
        key={`${start}-${raw}`}
        href={href}
        className="break-all underline underline-offset-4 hover:text-foreground"
        target={raw.startsWith("http") ? "_blank" : undefined}
        rel={raw.startsWith("http") ? "noreferrer" : undefined}
      >
        {label}
      </a>,
    );

    last = start + raw.length;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts;
}

export default function LifeSwitchPeopleMessagesPage() {
  const [selectedPersonId, setSelectedPersonId] = React.useState("");
  const [showNewMessage, setShowNewMessage] = React.useState(false);
  const [people, setPeople] = React.useState<PersonProfile[]>([]);
  const [relationships, setRelationships] = React.useState<Relationship[]>([]);
  const [loadingPeople, setLoadingPeople] = React.useState(false);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [draft, setDraft] = React.useState("");
  const [currentUserId, setCurrentUserId] = React.useState("");
  const currentUserIdRef = React.useRef("");
  const [authResolved, setAuthResolved] = React.useState(false);
  const [loadingConversations, setLoadingConversations] = React.useState(false);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [removingConversationId, setRemovingConversationId] =
    React.useState("");
  const savingRef = React.useRef(false);
  const connectionsRequestRef = React.useRef(0);
  const conversationsRequestRef = React.useRef(0);
  const messagesRequestRef = React.useRef(0);
  const mutationRequestRef = React.useRef(0);
  const selectedIdRef = React.useRef("");
  const selectedPersonIdRef = React.useRef("");
  const conversationSelectionVersionRef = React.useRef(0);
  const connectionContextVersionRef = React.useRef(0);
  const [error, setError] = React.useState("");

  const selectedConversation =
    conversations.find((c) => c.conversation_id === selectedId) || null;
  const acceptedConnections = React.useMemo(
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
  const canSend = selectedConversation?.can_send === true;

  function changeSelectedConversation(conversationId: string) {
    const changed = selectedIdRef.current !== conversationId;
    selectedIdRef.current = conversationId;
    setSelectedId(conversationId);

    if (changed) {
      conversationSelectionVersionRef.current += 1;
      messagesRequestRef.current += 1;
      setMessages([]);
      setDraft("");
      setLoadingMessages(false);
    }
  }

  function changeSelectedPerson(personId: string) {
    selectedPersonIdRef.current = personId;
    setSelectedPersonId(personId);
  }

  function clearUserScopedState() {
    connectionContextVersionRef.current += 1;
    connectionsRequestRef.current += 1;
    conversationsRequestRef.current += 1;
    messagesRequestRef.current += 1;
    mutationRequestRef.current += 1;
    savingRef.current = false;
    setSaving(false);
    setRemovingConversationId("");
    setPeople([]);
    setRelationships([]);
    setConversations([]);
    changeSelectedConversation("");
    changeSelectedPerson("");
    setMessages([]);
    setDraft("");
    setShowNewMessage(false);
    setLoadingMessages(false);
    setLoadingPeople(false);
    setLoadingConversations(false);
    setError("");
  }

  async function loadConnections(): Promise<boolean> {
    if (!authResolved || !currentUserIdRef.current) return false;
    const requestId = ++connectionsRequestRef.current;
    setLoadingPeople(true);
    setError("");
    try {
      const relationshipRows = await fetchJson<Relationship[]>(
        "/api/lifeswitch/people/relationships?include_inactive=1",
      );
      const acceptedIds = Array.from(
        new Set(
          relationshipRows
            .filter((relationship) => relationship.status === "accepted")
            .map((relationship) => relationship.other_user_id),
        ),
      );
      const profileRows = acceptedIds.length
        ? await fetchJson<PersonProfile[]>(
            `/api/lifeswitch/people/profiles?user_ids=${encodeURIComponent(acceptedIds.join(","))}`,
          )
        : [];

      if (requestId !== connectionsRequestRef.current) return false;
      setRelationships(relationshipRows);
      setPeople(profileRows);
      if (
        selectedPersonIdRef.current &&
        !acceptedIds.includes(selectedPersonIdRef.current)
      ) {
        changeSelectedPerson("");
      }
      return true;
    } catch (e) {
      if (requestId === connectionsRequestRef.current) {
        clearUserScopedState();
        setError(String(e instanceof Error ? e.message : e));
      }
      return false;
    } finally {
      if (requestId === connectionsRequestRef.current) {
        setLoadingPeople(false);
      }
    }
  }

  async function loadConversations(selectId?: string) {
    const requestId = ++conversationsRequestRef.current;
    const selectionVersionAtStart = conversationSelectionVersionRef.current;
    setLoadingConversations(true);
    setError("");
    try {
      const rows = await fetchJson<Conversation[]>(
        "/api/lifeswitch/people/conversations",
      );
      if (requestId !== conversationsRequestRef.current) return;
      setConversations(rows);
      const selectionChanged =
        conversationSelectionVersionRef.current !== selectionVersionAtStart;
      if (!selectionChanged && selectId) {
        changeSelectedConversation(
          rows.some((row) => row.conversation_id === selectId) ? selectId : "",
        );
      } else if (
        selectedIdRef.current &&
        !rows.some((row) => row.conversation_id === selectedIdRef.current)
      ) {
        changeSelectedConversation("");
      }
    } catch (e) {
      if (requestId === conversationsRequestRef.current) {
        setConversations([]);
        changeSelectedConversation("");
        setError(String(e instanceof Error ? e.message : e));
      }
    } finally {
      if (requestId === conversationsRequestRef.current) {
        setLoadingConversations(false);
      }
    }
  }

  async function loadMessages(conversationId: string) {
    if (!conversationId) return;
    const requestId = ++messagesRequestRef.current;
    setLoadingMessages(true);
    setError("");
    try {
      const rows = await fetchJson<Message[]>(
        `/api/lifeswitch/people/conversations/${encodeURIComponent(conversationId)}/messages`,
      );
      if (
        requestId !== messagesRequestRef.current ||
        selectedIdRef.current !== conversationId
      ) {
        return;
      }
      setMessages(rows);
    } catch (e) {
      if (
        requestId === messagesRequestRef.current &&
        selectedIdRef.current === conversationId
      ) {
        setMessages([]);
        setError(String(e instanceof Error ? e.message : e));
      }
    } finally {
      if (
        requestId === messagesRequestRef.current &&
        selectedIdRef.current === conversationId
      ) {
        setLoadingMessages(false);
      }
    }
  }

  async function startConversation() {
    if (savingRef.current) return;
    if (!authResolved || !currentUserId) {
      setError("Your signed-in session is not ready.");
      return;
    }
    const contextVersionAtStart = connectionContextVersionRef.current;
    const selectionVersionAtStart = conversationSelectionVersionRef.current;

    const relationship = relationships.find(
      (row) =>
        row.other_user_id === selectedPersonId && row.status === "accepted",
    );
    if (!relationship) {
      setError("Choose an accepted connection first.");
      return;
    }

    savingRef.current = true;
    const mutationRequestId = ++mutationRequestRef.current;
    setSaving(true);
    setError("");
    try {
      const c = await fetchJson<Conversation>(
        "/api/lifeswitch/people/conversations/direct",
        {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({ other_user_id: relationship.other_user_id }),
        },
      );
      if (connectionContextVersionRef.current !== contextVersionAtStart) return;
      changeSelectedPerson("");
      setShowNewMessage(false);
      await loadConversations(
        conversationSelectionVersionRef.current === selectionVersionAtStart
          ? c.conversation_id
          : undefined,
      );
    } catch (e) {
      if (connectionContextVersionRef.current === contextVersionAtStart) {
        setError(String(e instanceof Error ? e.message : e));
      }
    } finally {
      if (mutationRequestId === mutationRequestRef.current) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }

  async function sendMessage() {
    if (savingRef.current) return;
    if (!authResolved || !currentUserId) {
      setError("Your signed-in session is not ready.");
      return;
    }
    const contextVersionAtStart = connectionContextVersionRef.current;

    if (!canSend) {
      setError(
        "This connection is no longer active. Message history is read-only.",
      );
      return;
    }

    const body = draft.trim();
    if (!selectedId || !body) return;
    const conversationId = selectedId;

    savingRef.current = true;
    const mutationRequestId = ++mutationRequestRef.current;
    setSaving(true);
    setError("");
    try {
      await fetchJson<Message>(
        `/api/lifeswitch/people/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            body,
            body_format: "plain",
            metadata: { source: "lifeswitch_people_messages_ui" },
          }),
        },
      );
      if (connectionContextVersionRef.current !== contextVersionAtStart) return;
      if (selectedIdRef.current === conversationId) {
        setDraft("");
        await loadMessages(conversationId);
      }
      await loadConversations();
    } catch (e) {
      if (
        connectionContextVersionRef.current === contextVersionAtStart &&
        selectedIdRef.current === conversationId
      ) {
        setError(String(e instanceof Error ? e.message : e));
      }
    } finally {
      if (mutationRequestId === mutationRequestRef.current) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }

  async function removeConversationFromList() {
    if (!selectedConversation || selectedConversation.can_send === true) return;
    if (!authResolved || !currentUserId) {
      setError("Your signed-in session is not ready.");
      return;
    }

    const conversationId = selectedConversation.conversation_id;
    const name = displayUserName(
      selectedConversation.other_display_name,
      selectedConversation.other_user_id,
    );
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Remove the history-only conversation with ${name} from your list? The other account's copy and the underlying messages will not be deleted.`,
      )
    ) {
      return;
    }

    setRemovingConversationId(conversationId);
    setError("");
    try {
      await fetchJson<{ removed: string }>(
        `/api/lifeswitch/people/conversations/${encodeURIComponent(conversationId)}`,
        { method: "DELETE" },
      );
      if (selectedIdRef.current === conversationId) {
        changeSelectedConversation("");
      }
      await loadConversations();
    } catch (e) {
      if (selectedIdRef.current === conversationId) {
        setError(String(e instanceof Error ? e.message : e));
      }
    } finally {
      setRemovingConversationId("");
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

    void (async () => {
      if (await loadConnections()) {
        await loadConversations();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authResolved, currentUserId]);

  React.useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
  }, [selectedId]);

  return (
    <div className="grid max-w-full min-w-0 gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-2xl font-semibold">Messages</div>
          <div className="mt-1 text-sm [overflow-wrap:anywhere] break-words text-muted-foreground">
            One-to-one LifeSwitch conversations with your connections.
          </div>
        </div>

        <div
          className={[
            "flex flex-wrap gap-2",
            selectedConversation ? "hidden lg:flex" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <BackButton
            fallbackHref="/lifeswitch/people"
            label="People"
            className="rounded-md px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowNewMessage((v) => !v)}
            disabled={!authResolved || !currentUserId}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
          >
            {showNewMessage ? "Close" : "New message"}
          </button>
        </div>
      </div>

      {showNewMessage ? (
        <div className="max-w-full min-w-0 overflow-hidden border-y py-4">
          <div className="min-w-0 truncate text-sm font-semibold">
            New message
          </div>
          <div className="mt-2 grid max-w-full min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <select
              value={selectedPersonId}
              onChange={(e) => changeSelectedPerson(e.target.value)}
              disabled={loadingPeople || !authResolved || !currentUserId}
              className="min-w-0 rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">
                {loadingPeople
                  ? "Loading connections…"
                  : acceptedConnections.length
                    ? "Choose an accepted connection…"
                    : "No accepted connections"}
              </option>
              {acceptedConnections.map(({ person }) => (
                <option key={person.user_id} value={person.user_id}>
                  {displayUserName(person.display_name, person.user_id)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void startConversation()}
              disabled={
                saving || !selectedPersonId || !authResolved || !currentUserId
              }
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
            >
              Start
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid max-w-full min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section
          className={[
            "max-w-full min-w-0 overflow-hidden border-y",
            selectedConversation ? "hidden lg:order-1 lg:block" : "order-1",
          ].join(" ")}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="min-w-0 truncate text-sm font-semibold">
              Conversations
            </div>
            <button
              type="button"
              onClick={() =>
                void (async () => {
                  if (await loadConnections()) {
                    await loadConversations(selectedIdRef.current);
                  }
                })()
              }
              disabled={
                loadingConversations ||
                loadingPeople ||
                saving ||
                !authResolved ||
                !currentUserId
              }
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted/30 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          <div className="grid max-h-[520px] min-w-0 overflow-x-hidden overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No conversations yet.
              </div>
            ) : (
              conversations.map((c) => {
                const active = c.conversation_id === selectedId;
                const canSendToConversation = c.can_send === true;
                return (
                  <button
                    key={c.conversation_id}
                    type="button"
                    onClick={() => {
                      changeSelectedConversation(c.conversation_id);
                      setShowNewMessage(false);
                    }}
                    className={[
                      "w-full min-w-0 overflow-hidden border-b px-4 py-3 text-left hover:bg-muted/30",
                      active ? "bg-muted/20" : "",
                    ].join(" ")}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {c.title ||
                          displayUserName(
                            c.other_display_name,
                            c.other_user_id,
                          )}
                      </div>
                      {!canSendToConversation ? (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          History only
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 min-w-0 truncate text-xs text-muted-foreground">
                      {c.last_message_body || "No messages yet."}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {formatTime(c.last_message_created_at || c.updated_at)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section
          className={[
            "max-w-full min-w-0 overflow-hidden border-y",
            selectedConversation
              ? "order-1 lg:order-2"
              : "hidden lg:order-2 lg:block",
          ].join(" ")}
        >
          <div className="min-w-0 border-b px-4 py-3">
            {selectedConversation ? (
              <button
                type="button"
                onClick={() => {
                  changeSelectedConversation("");
                }}
                className="mb-2 rounded-md border px-2 py-1 text-xs hover:bg-muted/30 lg:hidden"
              >
                ← Messages
              </button>
            ) : null}

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 truncate text-sm font-semibold">
                {selectedConversation
                  ? selectedConversation.title ||
                    displayUserName(
                      selectedConversation.other_display_name,
                      selectedConversation.other_user_id,
                    )
                  : "Select a conversation"}
              </div>
              {selectedConversation && !canSend ? (
                <>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    Messaging unavailable · history only
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeConversationFromList()}
                    disabled={
                      Boolean(removingConversationId) ||
                      !authResolved ||
                      !currentUserId
                    }
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {removingConversationId ===
                    selectedConversation.conversation_id
                      ? "Removing…"
                      : "Remove"}
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="grid min-h-[420px] max-w-full min-w-0 content-start gap-3 overflow-x-hidden p-4">
            {!selectedConversation ? (
              <div className="text-sm text-muted-foreground">
                Start or select a conversation.
              </div>
            ) : loadingMessages ? (
              <div className="text-sm text-muted-foreground">
                Loading messages…
              </div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No messages yet.
              </div>
            ) : (
              messages.map((m) => {
                const mine =
                  currentUserId && m.author_user_id === currentUserId;

                return (
                  <div
                    key={m.message_id}
                    className={[
                      "max-w-[85%] min-w-0 overflow-hidden rounded-md border p-3",
                      mine
                        ? "justify-self-end bg-muted/30"
                        : "justify-self-start",
                    ].join(" ")}
                  >
                    <div className="text-xs text-muted-foreground">
                      {mine
                        ? "You"
                        : displayUserName(
                            m.author_display_name,
                            m.author_user_id,
                          )}{" "}
                      · {formatTime(m.created_at)}
                    </div>
                    <div className="mt-2 text-sm leading-relaxed [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                      {renderMessageBody(m.body)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t p-4">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                !selectedConversation
                  ? "Select a conversation first."
                  : canSend
                    ? "Type a message…"
                    : "This connection is no longer active. Prior messages remain available."
              }
              disabled={!canSend || saving}
              rows={3}
              className="w-full max-w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!canSend || !draft.trim() || saving}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
