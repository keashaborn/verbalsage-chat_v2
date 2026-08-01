"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Loader2,
  Trash2,
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authFetchJson } from "@/lib/authFetch";
import {
  buildInitialThreadSections,
  buildThreadSections,
} from "@/lib/threadSections";

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

type ConversationAction = "select_messages" | "copy_conversation";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return authFetchJson<T>(url, init);
}

function publishActiveThreadMetadata(
  threadId: string | null,
  availableThreads: ThreadItem[],
) {
  const activeThread = availableThreads.find(
    (thread) => thread.thread_id === threadId,
  );
  window.dispatchEvent(
    new CustomEvent("vs_active_thread_metadata", {
      detail: {
        thread_id: threadId,
        title: activeThread?.title || "New chat",
      },
    }),
  );
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
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(
    null,
  );
  const [historyExpanded, setHistoryExpanded] = React.useState(false);
  const [deleteCandidate, setDeleteCandidate] =
    React.useState<ThreadItem | null>(null);

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
      const [data, active] = await Promise.all([
        fetchJson<any[]>("/api/threads"),
        fetchJson<{ thread_id: string | null }>("/api/threads/active").catch(
          () => ({ thread_id: null }),
        ),
      ]);
      const normalized = (Array.isArray(data) ? data : [])
        .map((t: any) => ({
          ...t,
          thread_id: String(t?.thread_id || t?.id || "").trim(),
          pinned: Boolean(t?.pinned || t?.pinned_at),
        }))
        .filter((t: ThreadItem) => !!t.thread_id);
      const nextActiveThreadId = String(active.thread_id || "").trim() || null;
      setThreads(normalized);
      setActiveThreadId(nextActiveThreadId);
      publishActiveThreadMetadata(nextActiveThreadId, normalized);
    } catch {
      setThreads([]);
      setActionError("Chats could not be loaded. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }

  async function select(thread: ThreadItem) {
    if (Date.now() < suppressSelectUntilRef.current) return;

    const tid = String(thread.thread_id || "").trim();

    if (!tid) {
      setActionError("This chat could not be opened. The list was refreshed.");
      await refresh();
      return;
    }

    try {
      await fetchJson("/api/threads/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: tid }),
      });
      setActiveThreadId(tid);
      publishActiveThreadMetadata(tid, threads);
      window.dispatchEvent(
        new CustomEvent("vs_active_thread", {
          detail: { thread_id: tid, title: thread.title || "New chat" },
        }),
      );
      if (isMobile) setOpenMobile(false);
    } catch (e: any) {
      setActionError(e?.message || String(e));
      await refresh();
    }
  }

  function closeActionMenu() {
    setActionMenu(null);
  }

  async function runConversationAction(
    thread: ThreadItem,
    conversationAction: ConversationAction,
  ) {
    const tid = String(thread.thread_id || "").trim();
    closeActionMenu();
    if (!tid) return;

    setBusyThreadId(tid);
    setActionError("");
    try {
      await fetchJson("/api/threads/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: tid }),
      });
      setActiveThreadId(tid);
      publishActiveThreadMetadata(tid, threads);
      window.dispatchEvent(
        new CustomEvent("vs_active_thread", {
          detail: {
            thread_id: tid,
            title: thread.title || "New chat",
            conversation_action: conversationAction,
          },
        }),
      );
      if (isMobile) setOpenMobile(false);
    } catch (error: any) {
      setActionError(error?.message || String(error));
    } finally {
      setBusyThreadId(null);
    }
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

  function cancelRename() {
    setEditingId(null);
    setEditingTitle("");
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
      setDeleteCandidate(null);
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
    const onActiveThread = (event: Event) => {
      const detail = (
        event as CustomEvent<{ thread_id?: string | null; title?: string }>
      ).detail;
      const nextActiveThreadId = String(detail?.thread_id || "").trim() || null;
      setActiveThreadId(nextActiveThreadId);
      if (detail?.title) {
        window.dispatchEvent(
          new CustomEvent("vs_active_thread_metadata", { detail }),
        );
      } else {
        publishActiveThreadMetadata(nextActiveThreadId, threads);
      }
    };

    window.addEventListener("vs_active_thread", onActiveThread);
    return () => window.removeEventListener("vs_active_thread", onActiveThread);
  }, [threads]);

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
  const collapsedSections = buildInitialThreadSections(
    filtered,
    activeThreadId,
    5,
  );
  const collapsedThreadCount = new Set(
    collapsedSections.flatMap((section) =>
      section.threads.map((thread) => thread.thread_id),
    ),
  ).size;
  const hiddenThreadCount = Math.max(0, filtered.length - collapsedThreadCount);
  const sections =
    normalizedQuery || historyExpanded
      ? buildThreadSections(filtered)
      : collapsedSections;

  return (
    <div className="flex flex-col">
      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive-border bg-destructive-surface px-2.5 py-2 text-xs text-destructive-foreground"
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
              className="px-2 pt-1 pb-1 text-[11px] font-medium text-muted-foreground"
            >
              {section.label}
            </h2>

            <div className="flex flex-col">
              {section.threads.map((t) => {
                const tid = String(t.thread_id || t.id || "").trim();
                if (!tid) return null;

                const isMenuOpen = actionMenu?.thread.thread_id === tid;
                const isBusy = busyThreadId === tid;
                const isEditing = editingId === tid;
                const isActive = activeThreadId === tid;

                if (isMobile && isEditing) {
                  return (
                    <form
                      key={tid}
                      className="mx-2 my-1 grid min-w-0 gap-2 border-y py-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const input =
                          event.currentTarget.elements.namedItem("chat-name");
                        if (input instanceof HTMLInputElement) input.blur();
                        void commitRename(tid);
                      }}
                    >
                      <label
                        className="text-xs font-medium text-muted-foreground"
                        htmlFor={`rename-chat-${tid}`}
                      >
                        Rename chat
                      </label>
                      <input
                        id={`rename-chat-${tid}`}
                        name="chat-name"
                        className="w-full min-w-0 touch-manipulation bg-transparent px-0 py-2 text-[16px] outline-none"
                        value={editingTitle}
                        onChange={(event) =>
                          setEditingTitle(event.target.value)
                        }
                        aria-label="Chat name"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="min-h-11 min-w-11 px-2 py-2 text-sm text-muted-foreground"
                          onClick={cancelRename}
                          disabled={isBusy}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="min-h-11 min-w-11 px-2 py-2 text-sm font-medium"
                          disabled={isBusy || !editingTitle.trim()}
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  );
                }

                return (
                  <div
                    key={tid}
                    className={`group relative flex touch-manipulation items-center gap-1 rounded-lg px-2 py-1 select-none ${
                      isMenuOpen || isActive ? "bg-muted/70" : "hover:bg-muted"
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
                    {isActive && (
                      <span
                        className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-foreground/70"
                        aria-hidden="true"
                      />
                    )}
                    <button
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-1 py-2 text-left text-sm sm:min-h-9"
                      onClick={() => select({ ...t, thread_id: tid })}
                      aria-label={`Open chat ${t.title || "New chat"}`}
                      aria-current={isActive ? "page" : undefined}
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
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-100 hover:bg-background/60 hover:text-foreground sm:size-8 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
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
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {!loading && !normalizedQuery && hiddenThreadCount > 0 && (
        <button
          type="button"
          className="mx-2 mt-2 flex min-h-11 items-center justify-between border-t px-1 pt-3 text-xs text-muted-foreground hover:text-foreground sm:min-h-9"
          onClick={() => setHistoryExpanded((current) => !current)}
          aria-expanded={historyExpanded}
        >
          <span>
            {historyExpanded
              ? "Show fewer chats"
              : `Older chats (${hiddenThreadCount})`}
          </span>
          {historyExpanded ? (
            <ChevronUp className="size-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4" aria-hidden="true" />
          )}
        </button>
      )}

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
              onClick={() =>
                runConversationAction(actionMenu.thread, "select_messages")
              }
            >
              <ListChecks className="size-5" aria-hidden="true" />
              Select messages
            </button>
            <button
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
              onClick={() =>
                runConversationAction(actionMenu.thread, "copy_conversation")
              }
            >
              <Copy className="size-5" aria-hidden="true" />
              Copy conversation
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
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-destructive-foreground hover:bg-destructive-surface focus:bg-destructive-surface focus:outline-none"
              onClick={() => {
                setDeleteCandidate(actionMenu.thread);
                closeActionMenu();
              }}
            >
              <Trash2 className="size-5" aria-hidden="true" />
              Delete chat
            </button>
          </div>
        </div>
      )}

      {!isMobile && (
        <Dialog
          open={editingId !== null}
          onOpenChange={(open) => {
            if (!open && busyThreadId !== editingId) cancelRename();
          }}
        >
          <DialogContent
            className="max-w-sm rounded-2xl p-4"
            aria-describedby={undefined}
            showCloseButton={busyThreadId !== editingId}
          >
            <DialogHeader>
              <DialogTitle className="text-sm">Rename chat</DialogTitle>
            </DialogHeader>
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-base outline-none sm:text-sm"
              value={editingTitle}
              onChange={(event) => setEditingTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && editingId) {
                  void commitRename(editingId);
                }
              }}
              aria-label="Chat name"
              autoFocus
            />
            <DialogFooter className="mt-1 flex-row justify-end">
              <button
                className="rounded-xl bg-muted px-3 py-2 text-sm"
                onClick={cancelRename}
                disabled={busyThreadId === editingId}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-foreground px-3 py-2 text-sm text-background"
                onClick={() => {
                  if (editingId) void commitRename(editingId);
                }}
                disabled={
                  busyThreadId === editingId ||
                  !editingId ||
                  !editingTitle.trim()
                }
              >
                Save
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={deleteCandidate !== null}
        onOpenChange={(open) => {
          if (!open && busyThreadId !== deleteCandidate?.thread_id) {
            setDeleteCandidate(null);
          }
        }}
      >
        <DialogContent
          className="max-w-sm rounded-2xl p-4"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="text-sm">Delete chat?</DialogTitle>
            <DialogDescription>
              “{deleteCandidate?.title || "New chat"}” will be permanently
              deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 flex-row justify-end">
            <button
              type="button"
              className="min-h-11 rounded-xl bg-muted px-3 py-2 text-sm sm:min-h-9"
              onClick={() => setDeleteCandidate(null)}
              disabled={busyThreadId === deleteCandidate?.thread_id}
              autoFocus
            >
              Cancel
            </button>
            <button
              type="button"
              className="min-h-11 rounded-xl border border-destructive-border bg-destructive-surface px-3 py-2 text-sm font-medium text-destructive-foreground sm:min-h-9"
              onClick={() => {
                if (deleteCandidate) {
                  void deleteThread(deleteCandidate.thread_id);
                }
              }}
              disabled={busyThreadId === deleteCandidate?.thread_id}
            >
              {busyThreadId === deleteCandidate?.thread_id ? (
                <span className="inline-flex items-center gap-2" role="status">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Deleting…
                </span>
              ) : (
                "Delete"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
