"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LifeSwitchModeNav } from "@/components/lifeswitch/LifeSwitchModeNav";

export function LifeSwitchRouteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const measurementsStandalone = /^\/lifeswitch\/measurements(?:\/|$)/.test(
    pathname,
  );

  return (
    <>
      {measurementsStandalone ? null : <LifeSwitchModeNav />}
      <main
        className={`mx-auto max-w-5xl px-4 pt-6 ${
          measurementsStandalone
            ? "pb-10"
            : "pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-10"
        }`}
      >
        {children}
      </main>
    </>
  );
}
