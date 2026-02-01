"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Segment = { href: string; label: string };

export function SegmentTabs({ segments }: { segments: Segment[] }) {
  const pathname = usePathname() || "";

  return (
    <div className="inline-flex w-full overflow-hidden rounded-xl border bg-background">
      {segments.map((s) => {
        const active = pathname === s.href || pathname.startsWith(s.href + "/");
        return (
          <Link
            key={s.href}
            href={s.href}
            className={
              "flex-1 px-4 py-2 text-center text-sm font-semibold " +
              (active ? "bg-muted/50" : "hover:bg-muted/30")
            }
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
