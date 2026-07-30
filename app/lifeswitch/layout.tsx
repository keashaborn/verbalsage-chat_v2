// app/lifeswitch/layout.tsx
import type { ReactNode } from "react";
import { AppTopBar } from "@/components/nav/AppTopBar";
import { WorkspaceMenu } from "@/components/nav/WorkspaceMenu";
import { AccountMenu } from "@/components/nav/AccountMenu";
import { LifeSwitchModeNav } from "@/components/lifeswitch/LifeSwitchModeNav";
import { ConfirmActionProvider } from "@/components/lifeswitch/ConfirmActionProvider";

export default function LifeSwitchLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div data-lifeswitch-root className="min-h-dvh bg-background">
      <ConfirmActionProvider>
        <AppTopBar>
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <WorkspaceMenu label="LifeSwitch" align="left" variant="plain" />
            <AccountMenu />
          </div>
        </AppTopBar>

        <LifeSwitchModeNav />

        <main className="mx-auto max-w-5xl px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-10">
          {children}
        </main>
      </ConfirmActionProvider>
    </div>
  );
}
