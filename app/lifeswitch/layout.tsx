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
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-4">{children}</main>

      {/* Bottom tabs (fixed; LifeSwitch only) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-5 px-2 py-2 text-xs">
          <Link
            href="/lifeswitch"
            className="rounded-md px-3 py-2 text-center hover:bg-muted/30"
          >
            Home
          </Link>
          <Link
            href="/lifeswitch/training/calendar"
            className="rounded-md px-3 py-2 text-center hover:bg-muted/30"
          >
            Calendar
          </Link>
          <Link
            href="/lifeswitch/training/exercises"
            className="rounded-md px-3 py-2 text-center hover:bg-muted/30"
          >
            Exercises
          </Link>
          <Link
            href="/lifeswitch/training/workouts"
            className="rounded-md px-3 py-2 text-center hover:bg-muted/30"
          >
            Workouts
          </Link>
          <Link
            href="/lifeswitch/measurements"
            className="rounded-md px-3 py-2 text-center hover:bg-muted/30"
          >
            Measurements
          </Link>
        </div>
      </nav>
    </div>
  );
}
