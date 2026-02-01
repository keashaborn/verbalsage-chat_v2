"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, PencilRuler, PlusSquare, ClipboardList, LineChart } from "lucide-react";

function pickDomain(path: string): "nutrition" | "training" | "measurements" {
  const m = path.match(/^\/lifeswitch\/([^\/]+)/);
  const d = (m?.[1] || "").toLowerCase();
  if (d === "training") return "training";
  if (d === "measurements") return "measurements";
  return "nutrition";
}

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

export function LifeSwitchModeNav() {
  const pathname = usePathname() || "/lifeswitch";
  const domain = pickDomain(pathname);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-5xl grid-cols-5 px-2 pt-2">
        <Tab href={`/lifeswitch/${domain}/log`} label="Log" Icon={CalendarDays} />
        <Tab href={`/lifeswitch/${domain}/design`} label="Design" Icon={PencilRuler} />
        <Tab href={`/collect`} label="Capture" Icon={PlusSquare} />
        <Tab href={`/lifeswitch/${domain}/plan`} label="Plan" Icon={ClipboardList} />
        <Tab href={`/lifeswitch/${domain}/analyze`} label="Analyze" Icon={LineChart} />
      </div>
      <div className="mx-auto max-w-5xl border-t border-muted/20" />
    </nav>
  );
}
