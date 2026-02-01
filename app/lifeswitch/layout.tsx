// app/lifeswitch/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { WorkspaceMenu } from "@/components/nav/WorkspaceMenu";
import { LifeSwitchModeNav } from "@/components/lifeswitch/LifeSwitchModeNav";


export default function LifeSwitchLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh">
      {/* Top bar (sticky) */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {/* "Up" to LifeSwitch home (predictable, not history-based) */}
            <Link
              href="/lifeswitch/nutrition"
              aria-label="Back to LifeSwitch"
              className="rounded-md border px-2 py-1.5 text-xs hover:bg-muted/30 active:bg-muted/40"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            {/* Brand also navigates home */}
            <Link href="/lifeswitch/nutrition" className="text-sm font-semibold tracking-wide hover:opacity-80">
              LifeSwitch
            </Link>
          </div>

          {/* Replace Exit with workspace/domain menu */}
          <WorkspaceMenu label="LifeSwitch" />
        </div>
      </header>

      {/* Content (pad bottom so fixed nav doesn't cover it) */}
      <main className="mx-auto max-w-5xl px-4 pt-4 overflow-x-hidden pb-[calc(5.0rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Universal bottom nav (now applies to Nutrition too) */}
      <LifeSwitchModeNav />
    </div>
  );
}
