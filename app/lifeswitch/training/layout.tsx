// app/lifeswitch/training/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { Home, CalendarDays, Dumbbell, ClipboardList, Ruler } from "lucide-react";

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

export default function TrainingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh">
      <div className="pb-[calc(4.25rem+env(safe-area-inset-bottom))]">{children}</div>

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
