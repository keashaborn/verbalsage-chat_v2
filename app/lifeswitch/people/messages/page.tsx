"use client";

import * as React from "react";
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

function displayUserName(name: string | null | undefined, id: string | null | undefined): string {
  const clean = String(name || "").trim();
  return clean || `User ${shortId(id)}`;
}

export default function LifeSwitchPeopleMessagesPage() {
  const [otherUserId, setOtherUserId] = React.useState("");
  const [selectedPersonId, setSelectedPersonId] = React.useState("");
  const [people, setPeople] = React.useState<PersonProfile[]>([]);
  const [loadingPeople, setLoadingPeople] = React.useState(false);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [draft, setDraft] = React.useState("");
  const [currentUserId, setCurrentUserId] = React.useState("");
  const [loadingConversations, setLoadingConversations] = React.useState(false);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const [error, setError] = React.useState("");

  const selectedConversation = conversations.find((c) => c.conversation_id === selectedId) || null;

  async function loadPeople() {
    setLoadingPeople(true);
    setError("");
    try {
      const rows = await fetchJson<PersonProfile[]>("/api/lifeswitch/people/profiles");
      setPeople(rows);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoadingPeople(false);
    }
  }

  async function loadConversations(selectId?: string) {
    setLoadingConversations(true);
    setError("");
    try {
      const rows = await fetchJson<Conversation[]>("/api/lifeswitch/people/conversations");
      setConversations(rows);
      if (selectId) {
        setSelectedId(selectId);
      } else if (!selectedId && rows[0]?.conversation_id) {
        setSelectedId(rows[0].conversation_id);
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoadingConversations(false);
    }
  }

  async function loadMessages(conversationId: string) {
    if (!conversationId) return;
    setLoadingMessages(true);
    setError("");
    try {
      const rows = await fetchJson<Message[]>(
        `/api/lifeswitch/people/conversations/${encodeURIComponent(conversationId)}/messages`
      );
      setMessages(rows);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoadingMessages(false);
    }
  }

  async function startConversation() {
    if (savingRef.current) return;

    const other = (selectedPersonId || otherUserId).trim();
    if (!other) {
      setError("Choose a person or paste the other user's Supabase UUID first.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const c = await fetchJson<Conversation>("/api/lifeswitch/people/conversations/direct", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ other_user_id: other }),
      });
      setOtherUserId("");
      setSelectedPersonId("");
      await loadConversations(c.conversation_id);
      await loadMessages(c.conversation_id);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function sendMessage() {
    if (savingRef.current) return;

    const body = draft.trim();
    if (!selectedId || !body) return;

    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await fetchJson<Message>(`/api/lifeswitch/people/conversations/${encodeURIComponent(selectedId)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          body,
          body_format: "plain",
          metadata: { source: "lifeswitch_people_messages_ui" },
        }),
      });
      setDraft("");
      await loadMessages(selectedId);
      await loadConversations(selectedId);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      savingRef.current = false;
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
    void loadPeople();
    void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
  }, [selectedId]);

  return (
    <div className="grid gap-4">
      <div>
        <div className="text-lg font-semibold">Messages</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Internal one-to-one LifeSwitch messaging. Start a conversation by choosing a known person or pasting a Supabase user UUID.
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="text-sm font-semibold">Start conversation</div>
        <div className="mt-2 grid gap-2 lg:grid-cols-[280px_1fr_auto]">
          <select
            value={selectedPersonId}
            onChange={(e) => {
              setSelectedPersonId(e.target.value);
              if (e.target.value) setOtherUserId("");
            }}
            disabled={loadingPeople}
            className="min-w-0 rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">{loadingPeople ? "Loading people…" : "Choose a person…"}</option>
            {people
              .filter((p) => p.user_id !== currentUserId)
              .map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {displayUserName(p.display_name, p.user_id)}
                </option>
              ))}
          </select>

          <input
            value={otherUserId}
            onChange={(e) => {
              setOtherUserId(e.target.value);
              if (e.target.value.trim()) setSelectedPersonId("");
            }}
            placeholder="Or paste other_user_id UUID"
            className="min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
          />

          <button
            type="button"
            onClick={() => void startConversation()}
            disabled={saving || (!selectedPersonId && !otherUserId.trim())}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
          >
            Start
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="rounded-xl border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-sm font-semibold">Conversations</div>
            <button
              type="button"
              onClick={() => void loadConversations(selectedId)}
              disabled={loadingConversations}
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted/30 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          <div className="grid max-h-[520px] overflow-auto">
            {conversations.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No conversations yet.
              </div>
            ) : (
              conversations.map((c) => {
                const active = c.conversation_id === selectedId;
                return (
                  <button
                    key={c.conversation_id}
                    type="button"
                    onClick={() => setSelectedId(c.conversation_id)}
                    className={[
                      "border-b px-4 py-3 text-left hover:bg-muted/30",
                      active ? "bg-muted/20" : "",
                    ].join(" ")}
                  >
                    <div className="text-sm font-semibold">
                      {c.title || displayUserName(c.other_display_name, c.other_user_id)}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
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

        <section className="rounded-xl border">
          <div className="border-b px-4 py-3">
            <div className="text-sm font-semibold">
              {selectedConversation
                ? selectedConversation.title || displayUserName(selectedConversation.other_display_name, selectedConversation.other_user_id)
                : "Select a conversation"}
            </div>
            {selectedConversation ? (
              <div className="mt-1 text-xs text-muted-foreground">
                conversation_id: {selectedConversation.conversation_id}
              </div>
            ) : null}
          </div>

          <div className="grid min-h-[420px] content-start gap-3 p-4">
            {!selectedConversation ? (
              <div className="text-sm text-muted-foreground">
                Start or select a conversation.
              </div>
            ) : loadingMessages ? (
              <div className="text-sm text-muted-foreground">Loading messages…</div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-muted-foreground">No messages yet.</div>
            ) : (
              messages.map((m) => {
                const mine = currentUserId && m.author_user_id === currentUserId;

                return (
                  <div
                    key={m.message_id}
                    className={[
                      "max-w-[85%] rounded-xl border p-3",
                      mine ? "justify-self-end bg-muted/30" : "justify-self-start",
                    ].join(" ")}
                  >
                    <div className="text-xs text-muted-foreground">
                      {mine ? "You" : displayUserName(m.author_display_name, m.author_user_id)} · {formatTime(m.created_at)}
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{m.body}</div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t p-4">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={selectedConversation ? "Type a message…" : "Select a conversation first."}
              disabled={!selectedConversation || saving}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!selectedConversation || !draft.trim() || saving}
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
