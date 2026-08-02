// app/lifeswitch/layout.tsx
import type { ReactNode } from "react";
import { AppTopBar } from "@/components/nav/AppTopBar";
import { WorkspaceMenu } from "@/components/nav/WorkspaceMenu";
import { AccountMenu } from "@/components/nav/AccountMenu";
import { LifeSwitchRouteChrome } from "@/components/lifeswitch/LifeSwitchRouteChrome";
import { ConfirmActionProvider } from "@/components/lifeswitch/ConfirmActionProvider";
import { AuthGate } from "@/components/auth/AuthGate";
import { ProductAccessGate } from "@/components/auth/ProductAccessGate";

export default function LifeSwitchLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthGate>
      <ProductAccessGate product="lifeswitch">
        <div data-lifeswitch-root className="min-h-dvh bg-background">
          <ConfirmActionProvider>
            <AppTopBar>
              <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                <WorkspaceMenu
                  label="LifeSwitch"
                  align="left"
                  variant="plain"
                />
                <AccountMenu />
              </div>
            </AppTopBar>

            <LifeSwitchRouteChrome>{children}</LifeSwitchRouteChrome>
          </ConfirmActionProvider>
        </div>
      </ProductAccessGate>
    </AuthGate>
  );
}
