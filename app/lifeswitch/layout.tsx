// app/lifeswitch/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { Home, CalendarDays, Dumbbell, ClipboardList, Ruler } from "lucide-react";

export default function LifeSwitchLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh">
      {/* Top bar (sticky) */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold tracking-wide">LifeSwitch</div>
          {/* Exit to chat */}
          <Link href="/" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30">
            Exit
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-4">{children}</main>

      {/* Bottom tabs (fixed; LifeSwitch only) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-5xl grid-cols-5 px-2 pt-2">
          <Link
            href="/lifeswitch"
            className="rounded-md py-3 text-center hover:bg-muted/30 active:bg-muted/40"
            aria-label="Home"
          >
            <span className="mx-auto flex h-10 w-10 items-center justify-center">
              <Home className="h-5 w-5" />
            </span>
            <span className="sr-only">Home</span>
          </Link>

          <Link
            href="/lifeswitch/training/calendar"
            className="rounded-md py-3 text-center hover:bg-muted/30 active:bg-muted/40"
            aria-label="Calendar"
          >
            <span className="mx-auto flex h-10 w-10 items-center justify-center">
              <CalendarDays className="h-5 w-5" />
            </span>
            <span className="sr-only">Calendar</span>
          </Link>

          <Link
            href="/lifeswitch/training/exercises"
            className="rounded-md py-3 text-center hover:bg-muted/30 active:bg-muted/40"
            aria-label="Exercises"
          >
            <span className="mx-auto flex h-10 w-10 items-center justify-center">
              <Dumbbell className="h-5 w-5" />
            </span>
            <span className="sr-only">Exercises</span>
          </Link>

          <Link
            href="/lifeswitch/training/workouts"
            className="rounded-md py-3 text-center hover:bg-muted/30 active:bg-muted/40"
            aria-label="Workouts"
          >
            <span className="mx-auto flex h-10 w-10 items-center justify-center">
              <ClipboardList className="h-5 w-5" />
            </span>
            <span className="sr-only">Workouts</span>
          </Link>

          <Link
            href="/lifeswitch/measurements"
            className="rounded-md py-3 text-center hover:bg-muted/30 active:bg-muted/40"
            aria-label="Measurements"
          >
            <span className="mx-auto flex h-10 w-10 items-center justify-center">
              <Ruler className="h-5 w-5" />
            </span>
            <span className="sr-only">Measurements</span>
          </Link>
        </div>

        {/* extra bottom rule to visually “frame” the tab bar */}
        <div className="mx-auto max-w-5xl border-t border-muted/20" />
      </nav>
    </div>
  );
}
