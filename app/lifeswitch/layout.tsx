// app/lifeswitch/layout.tsx
import type { ReactNode } from "react";
import { WorkspaceMenu } from "@/components/nav/WorkspaceMenu";
import { LifeSwitchModeNav } from "@/components/lifeswitch/LifeSwitchModeNav";
import { LifeSwitchHelper } from "@/components/lifeswitch/helper/LifeSwitchHelper";

export default function LifeSwitchLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh overflow-x-clip">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3">
          <WorkspaceMenu label="LifeSwitch" align="left" variant="plain" />
        </div>
      </header>

      {/* Content (pad bottom so fixed nav doesn't cover it) */}
      <main className="mx-auto max-w-5xl px-4 pt-4 overflow-x-clip pb-[calc(5.0rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Floating page-aware helper */}
      <LifeSwitchHelper />

      {/* Mode bottom nav */}
      <LifeSwitchModeNav />
    </div>
  );
}
