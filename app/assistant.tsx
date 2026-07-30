"use client";

import { useMemo } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { TextStreamChatTransport } from "ai";
import { ThreadViewer } from "@/components/threads/ThreadViewer";
import { BrainsChatPane } from "@/components/threads/BrainsChatPane";
import { AppTopBar } from "@/components/nav/AppTopBar";
import { WorkspaceMenu } from "@/components/nav/WorkspaceMenu";
import { AccountMenu } from "@/components/nav/AccountMenu";

import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const Assistant = () => {
  const transport = useMemo(
    () => new TextStreamChatTransport({ api: "/api/chat" }),
    [],
  );

  const runtime = useChatRuntime({ transport });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <ThreadListSidebar />
          <SidebarInset>
            <AppTopBar className="flex h-16 items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <WorkspaceMenu
                  label="LifeSwitch"
                  align="left"
                  variant="plain"
                />
              </div>
              <AccountMenu />
            </AppTopBar>
            <div className="flex-1 overflow-hidden">
              <BrainsChatPane />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};
