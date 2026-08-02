"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTES = [
  { href: "/lifeswitch/people", label: "Connections" },
  { href: "/lifeswitch/people/helping", label: "Shared with me" },
  { href: "/lifeswitch/people/messages", label: "Messages" },
] as const;

export function PeopleWorkflowNav() {
  const pathname = usePathname() || "";

  return (
    <nav aria-label="People" className="border-y border-border/50">
      <div className="grid grid-cols-3 divide-x divide-border/50">
        {ROUTES.map(({ href, label }) => {
          const active = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-h-11 min-w-0 items-center justify-center px-2 py-2 text-center text-xs leading-tight font-medium transition-colors",
                "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active
                  ? "bg-muted/55 text-foreground"
                  : "text-muted-foreground hover:bg-muted/25 hover:text-foreground",
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
