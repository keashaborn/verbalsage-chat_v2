// app/collect/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AppTopBar } from "@/components/nav/AppTopBar";
import { AccountMenu } from "@/components/nav/AccountMenu";
import { WorkspaceMenu } from "@/components/nav/WorkspaceMenu";
import { LifeSwitchModeNav } from "@/components/lifeswitch/LifeSwitchModeNav";

export default function CollectLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <AppTopBar>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              aria-label="Back to Chat"
              className="rounded-md border px-2 py-1.5 text-xs hover:bg-muted/30 active:bg-muted/40"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <WorkspaceMenu label="LifeSwitch" align="left" variant="plain" />
          </div>

          <AccountMenu />
        </div>
      </AppTopBar>

      <main className="mx-auto max-w-5xl px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Treat Capture as part of the LifeSwitch “mode” system */}
      <LifeSwitchModeNav />
    </div>
  );
}
