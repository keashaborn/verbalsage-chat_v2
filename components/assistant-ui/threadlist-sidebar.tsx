"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { SettingsDrawer } from "@/components/admin/SettingsDrawer";
import { BrainsThreadList } from "@/components/threads/BrainsThreadList";
import Image from "next/image";

const BRAND_FILTER_SILVER =
  "grayscale brightness-125 contrast-125 opacity-85";

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const part = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!part) return "";
  try {
    return decodeURIComponent(part.split("=").slice(1).join("="));
  } catch {
    return part.split("=").slice(1).join("=");
  }
}

function normalizeVantageLabel(raw: string): string {
  const v = String(raw || "").trim();
  if (!v || v.toLowerCase() === "default") return "RESSE";
  return v.toUpperCase();
}

function ActiveVantageBadge() {
  const [vid, setVid] = React.useState("RESSE");

  React.useEffect(() => {
    const refresh = () => setVid(normalizeVantageLabel(readCookie("vs_vantage_id")));
    refresh();

    window.addEventListener("focus", refresh);
    window.addEventListener("vs_vantage_changed", refresh);
    window.addEventListener("vs_threads_refresh", refresh);

    const id = window.setInterval(refresh, 2000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("vs_vantage_changed", refresh);
      window.removeEventListener("vs_threads_refresh", refresh);
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="min-w-0 flex-1 leading-tight">
      <div className="truncate text-sm font-semibold">{vid}</div>
      <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
        Active Vantage
      </div>
    </div>
  );
}

export function ThreadListSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader className="aui-sidebar-header mb-2 border-b">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex aspect-square size-10 items-center justify-center rounded-lg overflow-hidden">
            <Image
              src="/brand/vs-icon.svg"
              alt="Verbal Sage"
              width={28}
              height={28}
              priority
            />
          </div>

          <ActiveVantageBadge />
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
                <SidebarMenuButton size="default" className="py-2">
                  <div className="flex items-center">
                    <div
                      className="relative translate-y-[1px]"
                      style={{ height: 16, width: 140 }}
                    >
                      <Image
                        src="/brand/admin-wordmark.norm.svg"
                        alt="Console"
                        fill
                        sizes="140px"
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
