"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { BrainsThreadList } from "@/components/threads/BrainsThreadList";
import Image from "next/image";

const BRAND_FILTER_SILVER =
  "grayscale brightness-125 contrast-125 opacity-85";

function AssistantBadge() {
  return (
    <div className="min-w-0 flex-1 leading-tight">
      <div className="truncate text-sm font-semibold">RESSE</div>
      <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
        Assistant
      </div>
    </div>
  );
}

export function ThreadListSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader className="aui-sidebar-header mb-2 border-b">
        <div className="flex items-center gap-3 px-2 py-2">
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

          <AssistantBadge />
        </div>
      </SidebarHeader>

      <SidebarContent className="aui-sidebar-content px-2">
        <BrainsThreadList />
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
