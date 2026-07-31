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
export const Assistant = () => {
  const { brand } = useSiteBrand();

  return (
    <SidebarProvider>
      <div className="flex h-dvh w-full max-w-full min-w-0 overflow-hidden pr-0.5">
        <ThreadListSidebar />
        <SidebarInset>
          <AppTopBar className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <WorkspaceMenu label={brand.name} align="left" variant="plain" />
            </div>
            <AccountMenu />
          </AppTopBar>
          <div className="max-w-full min-w-0 flex-1 overflow-hidden">
            <BrainsChatPane />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};
