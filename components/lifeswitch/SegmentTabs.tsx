"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Segment = { href: string; label: string };

export const segmentTabListClassName =
  "grid w-full max-w-full overflow-hidden rounded-lg border border-border/60 bg-muted/10 text-sm";

export function segmentTabClassName(active: boolean) {
  return [
    "flex min-h-11 min-w-0 items-center justify-center border-l border-border/40 px-3 py-2 text-center text-sm font-medium whitespace-nowrap outline-none transition-colors first:border-l-0 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
    active
      ? "bg-muted/50 text-foreground"
      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
  ].join(" ");
}

export function SegmentTabs({ segments }: { segments: Segment[] }) {
  const pathname = usePathname() || "";

  return (
    <div
      className={segmentTabListClassName}
      style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
    >
      {segments.map((seg) => {
        const active = pathname === seg.href || pathname.startsWith(seg.href + "/");
        return (
          <Link
            key={seg.href}
            href={seg.href}
            aria-current={active ? "page" : undefined}
            className={segmentTabClassName(active)}
          >
            {seg.label}
          </Link>
        );
      })}
    </div>
  );
}
