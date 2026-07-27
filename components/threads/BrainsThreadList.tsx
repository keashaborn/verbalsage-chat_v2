"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { authFetchJson } from "@/lib/authFetch";
import { buildThreadSections } from "@/lib/threadSections";

type ThreadItem = {
  thread_id: string;
  id?: string;
  title: string;
  updated_at: string;
  pinned: boolean;
  pinned_at?: string | null;
};

type ActionMenu = {
  thread: ThreadItem;
  x: number;
  y: number;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return authFetchJson<T>(url, init);
}

export function BrainsThreadList({ query = "" }: { query?: string }) {
  const [threads, setThreads] = React.useState<ThreadItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { isMobile, setOpenMobile } = useSidebar();

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingTitle, setEditingTitle] = React.useState("");
  const [actionMenu, setActionMenu] = React.useState<ActionMenu | null>(null);
  const [busyThreadId, setBusyThreadId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState("");

  const actionMenuRef = React.useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = React.useRef<number | null>(null);
  const pressOriginRef = React.useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const suppressSelectUntilRef = React.useRef(0);

  async function refresh() {
    setLoading(true);
    try {
      const data = await fetchJson<any[]>("/api/threads");
      const normalized = (Array.isArray(data) ? data : [])
        .map((t: any) => ({
          ...t,
          thread_id: String(t?.thread_id || t?.id || "").trim(),
          pinned: Boolean(t?.pinned || t?.pinned_at),
        }))
        .filter((t: ThreadItem) => !!t.thread_id);
      setThreads(normalized);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }

  async function select(thread_id: string) {
    if (Date.now() < suppressSelectUntilRef.current) return;

    const tid = String(thread_id || "").trim();

    if (!tid) {
      alert("Thread id missing. Refreshing thread list.");
      await refresh();
      return;
    }

    try {
      await fetchJson("/api/threads/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: tid }),
      });
      window.dispatchEvent(
        new CustomEvent("vs_active_thread", { detail: { thread_id: tid } }),
      );
      if (isMobile) setOpenMobile(false);
    } catch (e: any) {
      alert(e?.message || String(e));
      await refresh();
    }
  }

  function closeActionMenu() {
    setActionMenu(null);
  }

  function openActionMenu(thread: ThreadItem, x: number, y: number) {
    setActionError("");
    setActionMenu({ thread, x, y });
  }

  function startRename(t: ThreadItem) {
    closeActionMenu();
    setActionError("");
    setEditingId(t.thread_id);
    setEditingTitle(t.title || "New chat");
  }

  async function commitRename(thread_id: string) {
    const title = (editingTitle || "").trim();
    if (!title) return;

    setBusyThreadId(thread_id);
    setActionError("");
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
      setActionError(e?.message || String(e));
    } finally {
      setBusyThreadId(null);
    }
  }

  async function togglePin(t: ThreadItem) {
    const thread_id = t.thread_id;
    closeActionMenu();
    setBusyThreadId(thread_id);
    setActionError("");

    try {
      await fetchJson(`/api/threads/${encodeURIComponent(thread_id)}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !t.pinned }),
      });
      await refresh();
    } catch (e: any) {
      setActionError(e?.message || String(e));
    } finally {
      setBusyThreadId(null);
    }
  }

  async function deleteThread(thread_id: string) {
    closeActionMenu();
    setBusyThreadId(thread_id);
    setActionError("");

    try {
      const active = await fetchJson<{ thread_id: string | null }>(
        "/api/threads/active",
      ).catch(() => ({ thread_id: null }));
      const deletedActiveThread = active.thread_id === thread_id;

      await fetchJson(`/api/threads/${encodeURIComponent(thread_id)}`, {
        method: "DELETE",
      });
      await refresh();
      window.dispatchEvent(new Event("vs_threads_refresh"));

      if (deletedActiveThread) {
        const nextActive = await fetchJson<{ thread_id: string | null }>(
          "/api/threads/active",
        ).catch(() => ({ thread_id: null }));
        window.dispatchEvent(
          new CustomEvent("vs_active_thread", { detail: nextActive }),
        );
      }
    } catch (e: any) {
      setActionError(e?.message || String(e));
    } finally {
      setBusyThreadId(null);
    }
  }

  function cancelLongPress() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pressOriginRef.current = null;
  }

  function beginLongPress(
    event: React.PointerEvent<HTMLDivElement>,
    thread: ThreadItem,
  ) {
    if (event.pointerType === "mouse") return;

    cancelLongPress();
    pressOriginRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    longPressTimerRef.current = window.setTimeout(() => {
      suppressSelectUntilRef.current = Date.now() + 800;
      longPressTimerRef.current = null;
      pressOriginRef.current = null;
      openActionMenu(thread, event.clientX, event.clientY);
    }, 500);
  }

  function moveLongPress(event: React.PointerEvent<HTMLDivElement>) {
    const origin = pressOriginRef.current;
    if (!origin || origin.pointerId !== event.pointerId) return;

    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10) {
      cancelLongPress();
    }
  }

  React.useEffect(() => {
    refresh();
    const onRefresh = () => refresh();
    window.addEventListener("vs_threads_refresh", onRefresh);
    return () => window.removeEventListener("vs_threads_refresh", onRefresh);
  }, []);

  React.useEffect(() => {
    return () => cancelLongPress();
  }, []);

  React.useEffect(() => {
    if (!actionMenu) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeActionMenu();
    };
    const onResize = () => closeActionMenu();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [actionMenu]);

  React.useLayoutEffect(() => {
    if (!actionMenu || !actionMenuRef.current) return;

    const menu = actionMenuRef.current;
    const rect = menu.getBoundingClientRect();
    const left = Math.min(
      Math.max(12, actionMenu.x),
      Math.max(12, window.innerWidth - rect.width - 12),
    );
    const top = Math.min(
      Math.max(12, actionMenu.y),
      Math.max(12, window.innerHeight - rect.height - 12),
    );

    if (left !== actionMenu.x || top !== actionMenu.y) {
      setActionMenu((current) =>
        current ? { ...current, x: left, y: top } : current,
      );
    }

    menu
      .querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
  }, [actionMenu?.thread.thread_id]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = threads.filter((t) =>
    (t.title || "").toLowerCase().includes(normalizedQuery),
  );
  const sections = buildThreadSections(filtered);

  return (
    <div className="flex flex-col">
      {actionError && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
        >
          {actionError}
        </div>
      )}

      {loading && (
        <div className="px-2 text-xs text-muted-foreground">Loading…</div>
      )}

      {!loading && sections.length === 0 && (
        <div className="px-2 py-3 text-xs text-muted-foreground">
          {normalizedQuery ? "No chats found." : "No chats yet."}
        </div>
      )}

      <div className="flex flex-col">
        {sections.map((section) => (
          <section
            key={section.key}
            aria-labelledby={`thread-section-${section.key}`}
            className="pt-2 first:pt-0"
          >
            <h2
              id={`thread-section-${section.key}`}
              className="px-2 pt-1 pb-1 text-[11px] font-medium text-muted-foreground/75"
            >
              {section.label}
            </h2>

            <div className="flex flex-col">
              {section.threads.map((t) => {
                const tid = String(t.thread_id || t.id || "").trim();
                if (!tid) return null;

                const isEditing = editingId === tid;
                const isMenuOpen = actionMenu?.thread.thread_id === tid;
                const isBusy = busyThreadId === tid;

                return (
                  <div
                    key={tid}
                    className={`group flex touch-manipulation items-center gap-1 rounded-lg px-2 py-1 select-none ${
                      isMenuOpen ? "bg-muted" : "hover:bg-muted"
                    }`}
                    style={
                      { WebkitTouchCallout: "none" } as React.CSSProperties
                    }
                    title={t.updated_at}
                    onPointerDown={(event) =>
                      beginLongPress(event, { ...t, thread_id: tid })
                    }
                    onPointerMove={moveLongPress}
                    onPointerUp={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      cancelLongPress();
                      openActionMenu(
                        { ...t, thread_id: tid },
                        event.clientX,
                        event.clientY,
                      );
                    }}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-center gap-2 px-1 py-2 text-left text-sm"
                      onClick={() => select(tid)}
                      aria-label={`Open chat ${t.title || "New chat"}`}
                    >
                      {t.pinned && (
                        <Pin
                          className="size-3.5 shrink-0 fill-current"
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate">{t.title || "New chat"}</span>
                    </button>

                    <button
                      className="rounded-md p-2.5 text-muted-foreground opacity-100 hover:bg-background/60 hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        cancelLongPress();
                        const rect =
                          event.currentTarget.getBoundingClientRect();
                        openActionMenu(
                          { ...t, thread_id: tid },
                          rect.right - 224,
                          rect.bottom + 4,
                        );
                      }}
                      disabled={isBusy}
                      aria-label={`Actions for ${t.title || "New chat"}`}
                      aria-haspopup="menu"
                      aria-expanded={isMenuOpen}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>

                    {isEditing && (
                      <div
                        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
                        onPointerDown={(event) => {
                          if (event.target === event.currentTarget) {
                            setEditingId(null);
                            setEditingTitle("");
                          }
                        }}
                      >
                        <div
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby={`rename-chat-${tid}`}
                          className="w-full max-w-sm rounded-2xl border bg-background p-4 shadow-xl"
                        >
                          <div
                            id={`rename-chat-${tid}`}
                            className="text-sm font-semibold"
                          >
                            Rename chat
                          </div>
                          <input
                            className="mt-3 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(tid);
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
                              disabled={isBusy}
                            >
                              Cancel
                            </button>
                            <button
                              className="rounded-xl bg-foreground px-3 py-2 text-sm text-background"
                              onClick={() => commitRename(tid)}
                              disabled={isBusy || !editingTitle.trim()}
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
          </section>
        ))}
      </div>

      {actionMenu && (
        <div
          className="fixed inset-0 z-[9999]"
          onPointerDown={closeActionMenu}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            ref={actionMenuRef}
            role="menu"
            aria-label={`Actions for ${actionMenu.thread.title || "New chat"}`}
            className="fixed w-56 overflow-hidden rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-2xl"
            style={{ left: actionMenu.x, top: actionMenu.y }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
              onClick={() => togglePin(actionMenu.thread)}
            >
              {actionMenu.thread.pinned ? (
                <PinOff className="size-5" aria-hidden="true" />
              ) : (
                <Pin className="size-5" aria-hidden="true" />
              )}
              {actionMenu.thread.pinned ? "Unpin chat" : "Pin chat"}
            </button>
            <button
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
              onClick={() => startRename(actionMenu.thread)}
            >
              <Pencil className="size-5" aria-hidden="true" />
              Rename
            </button>
            <button
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:outline-none"
              onClick={() => deleteThread(actionMenu.thread.thread_id)}
            >
              <Trash2 className="size-5" aria-hidden="true" />
              Delete chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
