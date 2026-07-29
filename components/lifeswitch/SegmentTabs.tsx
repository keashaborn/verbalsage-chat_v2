"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Segment = { href: string; label: string };

export function SegmentTabs({ segments }: { segments: Segment[] }) {
  const pathname = usePathname() || "";

  return (
    <div className="w-full max-w-full overflow-hidden rounded-xl bg-muted/50 p-1">
      <div
        className="grid w-full"
        style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
      >
        {segments.map((seg) => {
          const active = pathname === seg.href || pathname.startsWith(seg.href + "/");
          return (
            <Link
              key={seg.href}
              href={seg.href}
              aria-current={active ? "page" : undefined}
              className={[
                "min-h-11 min-w-0 rounded-lg px-3 py-2.5 text-center text-sm font-semibold whitespace-nowrap transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              {seg.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
