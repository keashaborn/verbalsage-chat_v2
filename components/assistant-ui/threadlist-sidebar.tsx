"use client";

import * as React from "react";
import { MessagesSquare } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { SettingsDrawer } from "@/components/admin/SettingsDrawer";
import { BrainsThreadList } from "@/components/threads/BrainsThreadList";
import Image from "next/image";
import Link from "next/link";

export function ThreadListSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <Sidebar {...props}>
      {/* Header: icon only */}
      <SidebarHeader className="aui-sidebar-header mb-2 border-b">
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <div className="flex aspect-square size-10 items-center justify-center rounded-lg overflow-hidden">
            <Image
              src="/brand/vs-icon.svg"
              alt="Verbal Sage"
              width={28}
              height={28}
              priority
            />
          </div>

          <Link
            href="/collect"
            onClick={() => {
              if (isMobile) setOpenMobile(false);
            }}
            className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/60"
            title="Open data collection"
          >
            Collect
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent className="aui-sidebar-content px-2">
        <BrainsThreadList />
      </SidebarContent>

      <SidebarRail />

      <SidebarFooter className="aui-sidebar-footer border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SettingsDrawer
              trigger={
                <SidebarMenuButton size="lg">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-muted text-foreground">
                    <span className="text-xs font-semibold">VS</span>
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold">Admin</span>
                    <span className="text-xs text-muted-foreground">Settings</span>
                  </div>
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/lifeswitch">
                <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-muted text-foreground">
                  <span className="text-xs font-semibold">LS</span>
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">LifeSwitch</span>
                  <span className="text-xs text-muted-foreground">Studio</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
