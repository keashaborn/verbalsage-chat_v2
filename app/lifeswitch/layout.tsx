// app/lifeswitch/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, Home, CalendarDays, Dumbbell, ClipboardList, Ruler } from "lucide-react";

function Tab({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-[10px] hover:bg-muted/30 active:bg-muted/40"
    >
      <Icon className="h-5 w-5" />
      <span className="leading-none">{label}</span>
    </Link>
  );
}

function LifeSwitchMenu() {
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30">
        LifeSwitch ▾
      </summary>

      <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border bg-background shadow-lg">
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Workspace
        </div>
        <Link href="/" className="block px-3 py-2 text-sm hover:bg-muted/30">
          Back to Chat
        </Link>

        <div className="my-1 border-t border-muted/20" />

        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Domains
        </div>
        <Link href="/lifeswitch/nutrition" className="block px-3 py-2 text-sm hover:bg-muted/30">
          Nutrition
        </Link>
        <Link href="/lifeswitch/training" className="block px-3 py-2 text-sm hover:bg-muted/30">
          Training
        </Link>
        <Link href="/lifeswitch/measurements" className="block px-3 py-2 text-sm hover:bg-muted/30">
          Measurements
        </Link>
      </div>
    </details>
  );
}

export default function LifeSwitchLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh">
      {/* Top bar (sticky) */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {/* "Up" to LifeSwitch home (predictable, not history-based) */}
            <Link
              href="/lifeswitch"
              aria-label="Back to LifeSwitch"
              className="rounded-md border px-2 py-1.5 text-xs hover:bg-muted/30 active:bg-muted/40"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            {/* Brand also navigates home */}
            <Link href="/lifeswitch" className="text-sm font-semibold tracking-wide hover:opacity-80">
              LifeSwitch
            </Link>
          </div>

          {/* Replace Exit with workspace/domain menu */}
          <LifeSwitchMenu />
        </div>
      </header>

      {/* Content (pad bottom so fixed nav doesn't cover it) */}
      <main className="mx-auto max-w-5xl px-4 pt-4 overflow-x-hidden pb-[calc(5.0rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Universal bottom nav (now applies to Nutrition too) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-5xl grid-cols-5 px-2 pt-2">
          <Tab href="/lifeswitch" label="Home" Icon={Home} />
          <Tab href="/lifeswitch/training/calendar" label="Calendar" Icon={CalendarDays} />
          <Tab href="/lifeswitch/training/exercises" label="Exercises" Icon={Dumbbell} />
          <Tab href="/lifeswitch/training/workouts" label="Workouts" Icon={ClipboardList} />
          <Tab href="/lifeswitch/measurements" label="Measure" Icon={Ruler} />
        </div>
        <div className="mx-auto max-w-5xl border-t border-muted/20" />
      </nav>
    </div>
  );
}
