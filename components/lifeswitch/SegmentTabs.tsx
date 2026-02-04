"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Segment = { href: string; label: string };

export function SegmentTabs({ segments }: { segments: Segment[] }) {
  const pathname = usePathname() || "";

  return (
    <div className="w-full max-w-full overflow-hidden rounded-2xl border border-muted/30 bg-background/40">
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
              className={[
                "min-w-0 px-3 py-3 text-center text-sm font-semibold",
                "truncate",
                active ? "bg-muted/30" : "hover:bg-muted/20",
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
