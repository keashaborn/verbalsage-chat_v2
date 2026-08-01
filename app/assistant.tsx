"use client";

import { BrainsChatPane } from "@/components/threads/BrainsChatPane";
import { AppTopBar } from "@/components/nav/AppTopBar";
import { WorkspaceMenu } from "@/components/nav/WorkspaceMenu";
import { AccountMenu } from "@/components/nav/AccountMenu";
import { useSiteBrand } from "@/components/site/SiteBrandProvider";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { ActiveConversationTitle } from "@/components/threads/ActiveConversationTitle";
export const Assistant = () => {
  const { brand } = useSiteBrand();

  return (
    <SidebarProvider>
      <div className="flex h-dvh w-full max-w-full min-w-0 overflow-hidden pr-0.5">
        <a
          href="#chat-conversation"
          className="sr-only fixed top-2 left-2 z-[10000] rounded-md bg-background px-3 py-2 text-sm shadow-lg focus:not-sr-only"
        >
          Skip to conversation
        </a>
        <a
          href="#chat-composer"
          className="sr-only fixed top-2 left-2 z-[10000] rounded-md bg-background px-3 py-2 text-sm shadow-lg focus:not-sr-only"
        >
          Skip to message box
        </a>
        <ThreadListSidebar />
        <SidebarInset>
          <AppTopBar className="flex h-[calc(4rem+env(safe-area-inset-top))] items-center justify-between px-4 pt-[env(safe-area-inset-top)] md:grid md:h-16 md:grid-cols-[minmax(0,1fr)_minmax(0,42vw)_minmax(0,1fr)] md:gap-3 md:pt-0">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger />
              <WorkspaceMenu label={brand.name} align="left" variant="plain" />
            </div>
            <ActiveConversationTitle className="pointer-events-none hidden max-w-[32rem] justify-self-center md:block" />
            <div className="min-w-0 justify-self-end">
              <AccountMenu />
            </div>
          </AppTopBar>
          <ActiveConversationTitle className="border-b px-12 py-2 md:hidden" />
          <div className="max-w-full min-w-0 flex-1 overflow-hidden">
            <BrainsChatPane />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};
