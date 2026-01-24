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

const BRAND_MARK_H = 14; // px: shared optical height target
const BRAND_FILTER_SILVER =
  "grayscale brightness-125 contrast-125 opacity-85"; // tweak later

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
                <SidebarMenuButton size="default" className="py-2">
                  <div className="flex items-center">
                    <div className="relative" style={{ height: 12, width: 110 }}>
                      <Image
                        src="/brand/1%20-%20Life%20Switch%20-%20Word%20Mark%20-%20clr.svg"
                        alt="LifeSwitch"
                        fill
                        sizes="108px"
                        className={`object-contain object-left ${BRAND_FILTER_SILVER} scale-[0.92] origin-left`}
                      />
                    </div>
                  </div>
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>

          {/* SeeBx (drawer) */}
          <SidebarMenuItem className="border-t border-border/40">
            <SeebxDrawer
              trigger={
                <SidebarMenuButton size="default" className="py-2">
                  <div className="flex items-center">
                    <div className="relative" style={{ height: 12, width: 110 }}>
                      <Image
                        src="/brand/a%20-%20SEEBX%20-%20Word%20Mark%20-%20non%20tagline%20-%20clr.svg"
                        alt="Seebx"
                        fill
                        sizes="102px"
                        className={`object-contain object-left ${BRAND_FILTER_SILVER} scale-[0.92] origin-left`}
                      />
                    </div>
                  </div>
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>

          {/* Admin (drawer) */}
          <SidebarMenuItem className="border-t border-border/40">
            <SettingsDrawer
              trigger={
                <SidebarMenuButton size="default" className="py-2">
                  <div className="flex items-center">
                    <div className="relative" style={{ height: 18, width: 128}}>
                      <Image
                        src="/brand/svgweb.svg"
                        alt="Admin"
                        fill
                        sizes="118px"
                        className={`object-contain object-left ${BRAND_FILTER_SILVER} scale-[1.00] origin-left`}
                      />
                    </div>
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
