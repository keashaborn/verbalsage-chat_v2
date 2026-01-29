// app/lifeswitch/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";

export default function LifeSwitchLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh">
      {/* Top bar (sticky) */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold tracking-wide">LifeSwitch</div>
          <Link href="/" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30">
            Exit
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 pb-8 pt-4">{children}</main>
    </div>
  );
}
