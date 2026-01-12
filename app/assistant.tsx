"use client";

import { useMemo } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { TextStreamChatTransport } from "ai";
import { ThreadViewer } from "@/components/threads/ThreadViewer";
import { BrainsChatPane } from "@/components/threads/BrainsChatPane";

import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { Separator } from "@/components/ui/separator";
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
    []
  );

  const runtime = useChatRuntime({ transport });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SidebarProvider>
        <div className="flex h-svh w-full pr-0.5">
          <ThreadListSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <img
                src="/brand/svgweb.svg"
                alt="Verbal Sage"
                className="h-5 w-auto opacity-90"
              />
            </header>
            <div className="flex-1 overflow-hidden">
              <BrainsChatPane />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};
