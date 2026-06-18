"use client";

import * as React from "react";
import { PlusIcon, Pencil, Trash2 } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { authFetchJson } from "@/lib/authFetch";

type ThreadItem = { thread_id: string; title: string; updated_at: string };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return authFetchJson<T>(url, init);
}

export function BrainsThreadList() {
  const [threads, setThreads] = React.useState<ThreadItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const { isMobile, setOpenMobile } = useSidebar();

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingTitle, setEditingTitle] = React.useState("");

  async function refresh() {
    setLoading(true);
    try {
      const data = await fetchJson<ThreadItem[]>("/api/threads");
      setThreads(Array.isArray(data) ? data : []);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }

  async function newChat() {
    try {
      const created = await fetchJson<any>("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New chat" }),
      });

      await refresh();

      const tid =
        created?.thread_id ||
        (await fetchJson<{ thread_id: string | null }>("/api/threads/active")).thread_id;

      if (tid) {
        window.dispatchEvent(new CustomEvent("vs_active_thread", { detail: { thread_id: tid } }));
      }
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  async function select(thread_id: string) {
    try {
      await fetchJson("/api/threads/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id }),
      });
      window.dispatchEvent(new CustomEvent("vs_active_thread", { detail: { thread_id } }));
      if (isMobile) setOpenMobile(false);
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  function startRename(t: ThreadItem) {
    setEditingId(t.thread_id);
    setEditingTitle(t.title || "New chat");
  }

  async function commitRename(thread_id: string) {
    const title = (editingTitle || "").trim();
    if (!title) return;

    try {
      await fetchJson(`/api/threads/${encodeURIComponent(thread_id)}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setEditingId(null);
      setEditingTitle("");
      await refresh();
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  async function deleteThread(thread_id: string) {
    const ok = window.confirm("Delete this chat thread? This cannot be undone.");
    if (!ok) return;

    try {
      await fetchJson(`/api/threads/${encodeURIComponent(thread_id)}`, { method: "DELETE" });
      await refresh();
      window.dispatchEvent(new Event("vs_threads_refresh"));
      // if user deleted current thread, we let chat pane auto-create on next send
      window.dispatchEvent(new CustomEvent("vs_active_thread", { detail: { thread_id: null } }));
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  React.useEffect(() => {
    refresh();
    const onRefresh = () => refresh();
    window.addEventListener("vs_threads_refresh", onRefresh);
    return () => window.removeEventListener("vs_threads_refresh", onRefresh);
  }, []);

  const filtered = threads.filter((t) =>
    (t.title || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={newChat}
        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted"
      >
        <PlusIcon className="size-4" />
        New Chat
      </button>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search chats…"
        className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none"
      />

      {loading && <div className="px-2 text-xs text-muted-foreground">Loading…</div>}

      <div className="flex flex-col">
        {filtered.map((t) => {
          const isEditing = editingId === t.thread_id;

          return (
            <div
              key={t.thread_id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted"
              title={t.updated_at}
            >
              <button
                className="min-w-0 flex-1 truncate px-1 py-2 text-left text-sm"
                onClick={() => select(t.thread_id)}
              >
                {t.title || "New chat"}
              </button>

              <button
                className="rounded-md p-3 sm:p-2 text-muted-foreground hover:text-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                onClick={() => startRename(t)}
                aria-label="Rename"
              >
                <Pencil className="size-4" />
              </button>

              <button
                className="rounded-md p-3 sm:p-2 text-muted-foreground hover:text-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                onClick={() => deleteThread(t.thread_id)}
                aria-label="Delete"
              >
                <Trash2 className="size-4" />
              </button>

              {isEditing && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-sm rounded-2xl border bg-background p-4 shadow-xl">
                    <div className="text-sm font-semibold">Rename chat</div>
                    <input
                      className="mt-3 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(t.thread_id);
                        if (e.key === "Escape") {
                          setEditingId(null);
                          setEditingTitle("");
                        }
                      }}
                      autoFocus
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        className="rounded-xl bg-muted px-3 py-2 text-sm"
                        onClick={() => {
                          setEditingId(null);
                          setEditingTitle("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="rounded-xl bg-muted px-3 py-2 text-sm"
                        onClick={() => commitRename(t.thread_id)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
