// app/collect/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { WorkspaceMenu } from "@/components/nav/WorkspaceMenu";
import { LifeSwitchModeNav } from "@/components/lifeswitch/LifeSwitchModeNav";

export default function CollectLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              aria-label="Back to Chat"
              className="rounded-md border px-2 py-1.5 text-xs hover:bg-muted/30 active:bg-muted/40"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            <div className="text-sm font-semibold tracking-wide">Capture</div>
          </div>

          <WorkspaceMenu label="Workspace" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-4 overflow-x-hidden pb-[calc(5.0rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Treat Capture as part of the LifeSwitch “mode” system */}
      <LifeSwitchModeNav />
    </div>
  );
}
