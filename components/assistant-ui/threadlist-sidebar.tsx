"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { BrainsThreadList } from "@/components/threads/BrainsThreadList";
import { authFetchJson } from "@/lib/authFetch";
import Image from "next/image";
import { Loader2, MessageSquarePlus } from "lucide-react";

export function ThreadListSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const [query, setQuery] = React.useState("");
  const [creatingChat, setCreatingChat] = React.useState(false);
  const { isMobile, setOpenMobile } = useSidebar();

  async function newChat() {
    if (creatingChat) return;

    setCreatingChat(true);
    try {
      const created = await authFetchJson<any>("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New chat" }),
      });

      window.dispatchEvent(new Event("vs_threads_refresh"));

      const threadId =
        created?.thread_id ||
        created?.id ||
        (
          await authFetchJson<{ thread_id: string | null }>(
            "/api/threads/active",
          )
        ).thread_id;

      if (threadId) {
        window.dispatchEvent(
          new CustomEvent("vs_active_thread", {
            detail: { thread_id: threadId },
          }),
        );
        if (isMobile) setOpenMobile(false);
      }
    } catch (error: any) {
      alert(error?.message || String(error));
    } finally {
      setCreatingChat(false);
    }
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader className="aui-sidebar-header mb-2 border-b">
        <div className="flex items-center justify-between gap-3 px-2 py-2">
          <div className="flex aspect-square size-10 items-center justify-center overflow-hidden rounded-lg">
            <Image
              src="/brand/lifeswitch/symbol-dark-64.png"
              alt="LifeSwitch"
              width={28}
              height={28}
              priority
              className="dark:hidden"
            />
            <Image
              src="/brand/lifeswitch/symbol-light-64.png"
              alt="LifeSwitch"
              width={28}
              height={28}
              priority
              className="hidden dark:block"
            />
          </div>

          <button
            type="button"
            onClick={() => void newChat()}
            disabled={creatingChat}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border bg-background/60 text-foreground transition-[background-color,transform] hover:bg-muted active:scale-95 disabled:opacity-50"
            aria-label="New chat"
            title="New chat"
          >
            {creatingChat ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <MessageSquarePlus className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="px-2 pb-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats…"
            aria-label="Search chats"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="aui-sidebar-content px-2">
        <BrainsThreadList query={query} />
      </SidebarContent>

      <SidebarRail />

      <SidebarFooter className="aui-sidebar-footer border-t px-3 pb-3">
        <div className="py-2 pl-2 leading-tight">
          <div className="text-xs font-medium text-muted-foreground">
            LifeSwitch
          </div>
          <div className="text-[10px] text-muted-foreground/70">
            powered by Verbal Sage
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
