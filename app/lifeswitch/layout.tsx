// app/lifeswitch/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { WorkspaceMenu } from "@/components/nav/WorkspaceMenu";
import { LifeSwitchModeNav } from "@/components/lifeswitch/LifeSwitchModeNav";

const DEFAULT_LIFESWITCH = "/lifeswitch/training/log";

export default function LifeSwitchLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh">
      {/* Top bar (sticky) */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Predictable "up" to LifeSwitch default (not history-based) */}
            <Link
              href={DEFAULT_LIFESWITCH}
              aria-label="Back to LifeSwitch"
              className="rounded-md border px-2 py-1.5 text-xs hover:bg-muted/30 active:bg-muted/40"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            {/* Brand also navigates to default */}
            <Link
              href={DEFAULT_LIFESWITCH}
              className="text-sm font-semibold tracking-wide hover:opacity-80"
            >
              LifeSwitch
            </Link>
          </div>

          {/* Workspace / domain menu */}
          <WorkspaceMenu label="LifeSwitch" />
        </div>
      </header>

      {/* Content (pad bottom so fixed nav doesn't cover it) */}
      <main className="mx-auto max-w-5xl px-4 pt-4 overflow-x-hidden pb-[calc(5.0rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Mode bottom nav */}
      <LifeSwitchModeNav />
    </div>
  );
}
