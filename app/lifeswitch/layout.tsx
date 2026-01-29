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
          {/* Exit to chat */}
          <Link
            href="/"
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30"
          >
            Exit
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Bottom tabs (fixed; LifeSwitch only) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-5xl grid-cols-5 px-2 pt-2">
          <Link href="/lifeswitch" className="rounded-md py-3 text-center text-sm hover:bg-muted/30 active:bg-muted/40">
            Home
          </Link>
          <Link
            href="/lifeswitch/training/calendar"
            className="rounded-md py-3 text-center text-sm hover:bg-muted/30 active:bg-muted/40"
          >
            Calendar
          </Link>
          <Link
            href="/lifeswitch/training/exercises"
            className="rounded-md py-3 text-center text-sm hover:bg-muted/30 active:bg-muted/40"
          >
            Exercises
          </Link>
          <Link
            href="/lifeswitch/training/workouts"
            className="rounded-md py-3 text-center text-sm hover:bg-muted/30 active:bg-muted/40"
          >
            Workouts
          </Link>
          <Link
            href="/lifeswitch/measurements"
            className="rounded-md py-3 text-center text-sm hover:bg-muted/30 active:bg-muted/40"
          >
            Measurements
          </Link>
        </div>

        {/* extra line under tabs + a little breathing room */}
        <div className="mx-auto max-w-5xl border-t border-muted/20" />
      </nav>
    </div>
  );
}
