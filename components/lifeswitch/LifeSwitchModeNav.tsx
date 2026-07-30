"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  LineChart,
  PlusSquare,
} from "lucide-react";

const MODES = ["log", "design", "capture", "plan", "analyze"] as const;
const ACTIVE_DOMAINS = new Set(["nutrition", "training", "measurements"]);

type Mode = (typeof MODES)[number];

function normalizeDomainFromPath(pathname: string): string {
  const m = String(pathname || "").match(/^\/lifeswitch\/([^\/?#]+)/);
  const d = (m?.[1] || "").toLowerCase();

  if (!d) return "";
  if (d === "plan") return "plan";
  if (!ACTIVE_DOMAINS.has(d)) return "";

  return d;
}

function normalizeModeFromPath(pathname: string): Mode {
  if (String(pathname || "").match(/^\/lifeswitch\/plan(?:[\/?#]|$)/))
    return "plan";

  const m = String(pathname || "").match(/^\/lifeswitch\/[^\/?#]+\/([^\/?#]+)/);
  const mode = (m?.[1] || "").toLowerCase() as Mode;

  return (MODES as readonly string[]).includes(mode) ? mode : "log";
}

function normalizePlanSectionFromBrowser(): string {
  if (typeof window === "undefined") return "";

  const raw = new URLSearchParams(window.location.search).get("section") || "";
  const section = raw.toLowerCase();

  return ACTIVE_DOMAINS.has(section) ? section : "";
}

function Tab({
  href,
  label,
  Icon,
  active,
  onClick,
  compact = false,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={[
        "flex min-w-0 items-center justify-center rounded-xl transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        compact
          ? "flex-col gap-1 px-2 py-2 text-[10px]"
          : "gap-2 px-4 py-2 text-sm font-medium",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-border/40"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground active:bg-muted/80",
      ].join(" ")}
    >
      <Icon className={compact ? "h-5 w-5" : "h-4 w-4"} />
      <span className={compact ? "leading-none" : "whitespace-nowrap"}>
        {label}
      </span>
    </Link>
  );
}

function planHrefForDomain(domain: string) {
  if (domain === "training")
    return "/lifeswitch/plan?section=training#training-targets";
  if (domain === "nutrition")
    return "/lifeswitch/plan?section=nutrition#nutrition-targets";
  if (domain === "measurements")
    return "/lifeswitch/plan?section=measurements#body-state";
  return "/lifeswitch/plan";
}

function designHrefForDomain(domain: string) {
  if (domain === "training") return "/lifeswitch/training/design/workouts";
  return `/lifeswitch/${domain}/design`;
}

export function LifeSwitchModeNav() {
  const pathname = usePathname() || "";
  const rawDomain = normalizeDomainFromPath(pathname);
  const [planSection, setPlanSection] = React.useState("");

  React.useEffect(() => {
    if (rawDomain === "plan") {
      setPlanSection(normalizePlanSectionFromBrowser());
    } else {
      setPlanSection("");
    }
  }, [rawDomain, pathname]);

  const domain = rawDomain === "plan" ? planSection : rawDomain;
  const mode = rawDomain === "plan" ? "plan" : normalizeModeFromPath(pathname);

  React.useEffect(() => {
    if (
      domain &&
      rawDomain !== "measurements" &&
      typeof window !== "undefined"
    ) {
      window.localStorage.setItem("lifeswitch:lastDomain", domain);
    }
  }, [domain, rawDomain]);

  if (!domain || rawDomain === "measurements") return null;

  const logHref =
    domain === "training"
      ? "/lifeswitch/training/calendar"
      : `/lifeswitch/${domain}/log`;
  const captureHref = `/lifeswitch/${domain}/capture`;
  const designHref = designHrefForDomain(domain);
  const DesignIcon = domain === "training" ? Dumbbell : BookOpen;

  const rememberDomain = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("lifeswitch:lastDomain", domain);
    }
  };

  const tabs = [
    {
      href: logHref,
      label: "Log",
      Icon: CalendarDays,
      active: mode === "log",
    },
    {
      href: designHref,
      label: domain === "training" ? "Workouts" : "Library",
      Icon: DesignIcon,
      active: mode === "design",
    },
    {
      href: captureHref,
      label: "Capture",
      Icon: PlusSquare,
      active: mode === "capture",
    },
    {
      href: planHrefForDomain(domain),
      label: "Plan",
      Icon: ClipboardList,
      active: mode === "plan",
    },
    {
      href: `/lifeswitch/${domain}/analyze`,
      label: "Analyze",
      Icon: LineChart,
      active: mode === "analyze",
    },
  ];

  return (
    <>
      <nav
        aria-label={`${domain} workflow`}
        className="sticky top-14 z-40 hidden border-b border-border/40 bg-background supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-xl md:block"
      >
        <div className="mx-auto flex max-w-5xl px-4 py-2">
          <div className="inline-grid grid-cols-5 gap-1 rounded-2xl bg-muted/50 p-1">
            {tabs.map((tab) => (
              <Tab key={tab.href} {...tab} onClick={rememberDomain} />
            ))}
          </div>
        </div>
      </nav>

      <nav
        aria-label={`${domain} workflow`}
        className="fixed right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 z-50 rounded-2xl border border-border/60 bg-card p-1.5 shadow-xl ring-1 ring-foreground/5 supports-[backdrop-filter]:bg-card/80 supports-[backdrop-filter]:backdrop-blur-2xl md:hidden"
      >
        <div className="grid grid-cols-5 gap-1">
          {tabs.map((tab) => (
            <Tab key={tab.href} {...tab} compact onClick={rememberDomain} />
          ))}
        </div>
      </nav>
    </>
  );
}
