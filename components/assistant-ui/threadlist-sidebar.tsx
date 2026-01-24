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
import { LifeSwitchDrawer } from "@/components/lifeswitch/LifeSwitchDrawer";
import { BrainsThreadList } from "@/components/threads/BrainsThreadList";
import Image from "next/image";
import Link from "next/link";
import { SeebxDrawer } from "@/components/seebx/SeebxDrawer";

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
            title="Open data capture"
          >
            Capture
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent className="aui-sidebar-content px-2">
        <BrainsThreadList />
      </SidebarContent>

      <SidebarRail />

      <SidebarFooter className="aui-sidebar-footer border-t">
        <SidebarMenu>
          {/* LifeSwitch (drawer) */}
          <SidebarMenuItem>
            <LifeSwitchDrawer
              trigger={
                <SidebarMenuButton size="lg">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-muted text-foreground">
                    <span className="text-xs font-semibold">LS</span>
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <div className="relative h-4 w-[150px]">
                      <Image
                        src="/brand/1%20-%20Life%20Switch%20-%20Word%20Mark%20-%20clr.svg"
                        alt="LifeSwitch"
                        fill
                        sizes="150px"
                        className="object-contain object-left"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">Studio</span>
                  </div>
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>

          {/* SeeBx (drawer) */}
          <SidebarMenuItem>
            <SeebxDrawer
              trigger={
                <SidebarMenuButton size="lg">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-muted text-foreground">
                    <span className="text-xs font-semibold">SB</span>
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <div className="relative h-4 w-[150px]">
                      <Image
                        src="/brand/a%20-%20SEEBX%20-%20Word%20Mark%20-%20non%20tagline%20-%20clr.svg"
                        alt="Seebx"
                        fill
                        sizes="150px"
                        className="object-contain object-left"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">Workspace</span>
                  </div>
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>

          {/* Admin (drawer) */}
          <SidebarMenuItem>
            <SettingsDrawer
              trigger={
                <SidebarMenuButton size="lg">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-muted text-foreground">
                    <span className="text-xs font-semibold">VS</span>
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <div className="relative h-4 w-[150px]">
                      <Image
                        src="/brand/svgweb.svg"
                        alt="Admin"
                        fill
                        sizes="150px"
                        className="object-contain object-left"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">Settings</span>
                  </div>
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
