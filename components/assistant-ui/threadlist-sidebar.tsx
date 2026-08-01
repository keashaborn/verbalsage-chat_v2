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
import { useSiteBrand } from "@/components/site/SiteBrandProvider";

export function ThreadListSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { brand } = useSiteBrand();
  const [query, setQuery] = React.useState("");
  const [creatingChat, setCreatingChat] = React.useState(false);
  const [createError, setCreateError] = React.useState("");
  const { isMobile, setOpenMobile } = useSidebar();

  async function newChat() {
    if (creatingChat) return;

    setCreatingChat(true);
    setCreateError("");
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
        const detail = { thread_id: threadId, title: "New chat" };
        window.dispatchEvent(
          new CustomEvent("vs_active_thread", {
            detail,
          }),
        );
        window.dispatchEvent(
          new CustomEvent("vs_active_thread_metadata", { detail }),
        );
        if (isMobile) setOpenMobile(false);
      }
    } catch (error: any) {
      setCreateError(error?.message || String(error));
    } finally {
      setCreatingChat(false);
    }
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader className="aui-sidebar-header mb-2 border-b pt-[env(safe-area-inset-top)] md:pt-0">
        <div className="flex items-center justify-between gap-3 px-2 py-2">
          <div className="flex aspect-square size-10 items-center justify-center overflow-hidden rounded-lg">
            <Image
              src={brand.iconLight}
              alt={brand.name}
              width={28}
              height={28}
              priority
              unoptimized
              className="dark:hidden"
            />
            <Image
              src={brand.iconDark}
              alt={brand.name}
              width={28}
              height={28}
              priority
              unoptimized
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
            className="min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-base outline-none sm:min-h-9 sm:text-sm"
          />
          {createError && (
            <div
              className="mt-2 rounded-lg border border-destructive-border bg-destructive-surface px-2.5 py-2 text-xs text-destructive-foreground"
              role="alert"
            >
              {createError}
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="aui-sidebar-content px-2">
        <BrainsThreadList query={query} />
      </SidebarContent>

      <SidebarRail />

      <SidebarFooter className="aui-sidebar-footer border-t px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
        <div className="py-2 pl-2 leading-tight">
          <div className="text-xs font-medium text-muted-foreground">
            {brand.name}
          </div>
          {brand.attribution ? (
            <div className="text-[10px] text-muted-foreground/70">
              {brand.attribution}
            </div>
          ) : null}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
