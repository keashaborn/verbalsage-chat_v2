"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type Segment = { href: string; label: string };

export function SegmentTabs({ segments }: { segments: Segment[] }) {
  const pathname = usePathname() || "";

  const activeHref = React.useMemo(() => {
    // Pick the longest matching prefix so nested routes highlight correctly.
    let best = "";
    for (const s of segments) {
      const h = s.href || "";
      if (!h) continue;
      if (pathname === h || pathname.startsWith(h + "/")) {
        if (h.length > best.length) best = h;
      }
    }
    return best || (segments[0]?.href ?? "");
  }, [pathname, segments]);

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex w-full min-w-0 rounded-2xl border bg-muted/10 p-1">
        {segments.map((s) => {
          const active = s.href === activeHref;
          return (
            <Link
              key={s.href}
              href={s.href}
              className={[
                "flex-1 min-w-0 rounded-xl px-3 py-2 text-center text-sm font-semibold",
                "transition-colors",
                active ? "bg-background/60" : "hover:bg-muted/30 active:bg-muted/40",
              ].join(" ")}
            >
              <span className="block truncate">{s.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
