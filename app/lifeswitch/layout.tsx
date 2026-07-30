// app/lifeswitch/layout.tsx
import type { ReactNode } from "react";
import { WorkspaceMenu } from "@/components/nav/WorkspaceMenu";
import { AccountMenu } from "@/components/nav/AccountMenu";
import { LifeSwitchModeNav } from "@/components/lifeswitch/LifeSwitchModeNav";
import { LifeSwitchHelper } from "@/components/lifeswitch/helper/LifeSwitchHelper";

export default function LifeSwitchLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div data-lifeswitch-root className="min-h-svh bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background shadow-xs supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <WorkspaceMenu label="LifeSwitch" align="left" variant="plain" />
          <div className="flex items-center gap-1">
            <LifeSwitchHelper />
            <AccountMenu />
          </div>
        </div>
      </header>

      <LifeSwitchModeNav />

      <main className="mx-auto max-w-5xl px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-10">
        {children}
      </main>
    </div>
  );
}
