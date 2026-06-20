"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, BookOpen, PlusSquare, ClipboardList, LineChart, Dumbbell } from "lucide-react";

const MODES = ["log", "design", "capture", "plan", "analyze"] as const;
type Mode = typeof MODES[number];

function normalizeDomainFromPath(pathname: string): string {
  // Expected: /lifeswitch/<domain>/...
  // Domains we currently support (plus future placeholders).
  const m = String(pathname || "").match(/^\/lifeswitch\/([^\/?#]+)/);
  const d = (m?.[1] || "").toLowerCase();

  // If user is on /lifeswitch (no domain), or an unexpected path,
  // fall back to nutrition (safe default).
  if (!d) return "nutrition";

  // Accept any domain segment so new domains work without code changes.
  // Optionally clamp later if you want hard allow-list.
  return d;
}

function normalizeModeFromPath(pathname: string): Mode {
  const m = String(pathname || "").match(/^\/lifeswitch\/[^\/?#]+\/([^\/?#]+)/);
  const mode = (m?.[1] || "").toLowerCase() as Mode;
  return (MODES as readonly string[]).includes(mode) ? mode : "log";
}

function Tab({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-[10px]",
        "hover:bg-muted/30 active:bg-muted/40",
        active ? "opacity-100" : "opacity-80",
      ].join(" ")}
    >
      <Icon className="h-5 w-5" />
      <span className="leading-none">{label}</span>
    </Link>
  );
}

export function LifeSwitchModeNav() {
  const pathname = usePathname() || "";
  const domain = normalizeDomainFromPath(pathname);
  const mode = normalizeModeFromPath(pathname);

  // Capture is global, but we preserve domain as a query param for filtering.
  const captureHref = `/lifeswitch/${domain}/capture`;
    const designHref = domain === "training" ? "/lifeswitch/training/design/workouts" : `/lifeswitch/${domain}/design`;
    const designLabel = domain === "training" ? "Workouts" : "Library";
    const DesignIcon = domain === "training" ? Dumbbell : BookOpen;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-5xl grid-cols-5 px-2 pt-2">
        <Tab
          href={`/lifeswitch/${domain}/log`}
          label="Log"
          Icon={CalendarDays}
          active={mode === "log"}
        />
        <Tab
          href={designHref}
          label={designLabel}
          Icon={DesignIcon}
          active={mode === "design"}
        />
        <Tab
          href={captureHref}
          label="Capture"
          Icon={PlusSquare}
          active={mode === "capture"}
        />
        <Tab
          href={`/lifeswitch/${domain}/plan`}
          label="Plan"
          Icon={ClipboardList}
          active={mode === "plan"}
        />
        <Tab
          href={`/lifeswitch/${domain}/analyze`}
          label="Analyze"
          Icon={LineChart}
          active={mode === "analyze"}
        />
      </div>
      <div className="mx-auto max-w-5xl border-t border-muted/20" />
    </nav>
  );
}
