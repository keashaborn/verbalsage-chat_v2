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

type Mode = typeof MODES[number];

function normalizeDomainFromPath(pathname: string): string {
  const m = String(pathname || "").match(/^\/lifeswitch\/([^\/?#]+)/);
  const d = (m?.[1] || "").toLowerCase();

  if (!d) return "";
  if (d === "plan") return "plan";
  if (!ACTIVE_DOMAINS.has(d)) return "";

  return d;
}

function normalizeModeFromPath(pathname: string): Mode {
  if (String(pathname || "").match(/^\/lifeswitch\/plan(?:[\/?#]|$)/)) return "plan";

  const m = String(pathname || "").match(/^\/lifeswitch\/[^\/?#]+\/([^\/?#]+)/);
  const mode = (m?.[1] || "").toLowerCase() as Mode;

  return (MODES as readonly string[]).includes(mode) ? mode : "log";
}

function Tab({
  href,
  label,
  Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
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

function planHrefForDomain(domain: string) {
  if (domain === "training") return "/lifeswitch/plan#training-targets";
  if (domain === "nutrition") return "/lifeswitch/plan#nutrition-targets";
  if (domain === "measurements") return "/lifeswitch/plan#body-state";
  return "/lifeswitch/plan";
}

function designHrefForDomain(domain: string) {
  if (domain === "training") return "/lifeswitch/training/design/workouts";
  return `/lifeswitch/${domain}/design`;
}

function designLabelForDomain(domain: string) {
  if (domain === "training") return "Workouts";
  if (domain === "measurements") return "Methods";
  return "Library";
}

export function LifeSwitchModeNav() {
  const pathname = usePathname() || "";
  const domain = normalizeDomainFromPath(pathname);
  const mode = normalizeModeFromPath(pathname);

  React.useEffect(() => {
    if (domain && domain !== "plan" && typeof window !== "undefined") {
      window.localStorage.setItem("lifeswitch:lastDomain", domain);
    }
  }, [domain]);

  if (!domain) return null;

  if (domain === "plan") return null;

  const logHref = domain === "training" ? "/lifeswitch/training/calendar" : `/lifeswitch/${domain}/log`;
  const captureHref = `/lifeswitch/${domain}/capture`;
  const designHref = designHrefForDomain(domain);
  const designLabel = designLabelForDomain(domain);
  const DesignIcon = domain === "training" ? Dumbbell : BookOpen;

  const rememberDomain = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("lifeswitch:lastDomain", domain);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-5xl grid-cols-5 px-2 pt-2">
        <Tab
          href={logHref}
          label="Log"
          Icon={CalendarDays}
          active={mode === "log"}
          onClick={rememberDomain}
        />
        <Tab
          href={designHref}
          label={designLabel}
          Icon={DesignIcon}
          active={mode === "design"}
          onClick={rememberDomain}
        />
        <Tab
          href={captureHref}
          label="Capture"
          Icon={PlusSquare}
          active={mode === "capture"}
          onClick={rememberDomain}
        />
        <Tab
          href={planHrefForDomain(domain)}
          label="Plan"
          Icon={ClipboardList}
          active={mode === "plan"}
          onClick={rememberDomain}
        />
        <Tab
          href={`/lifeswitch/${domain}/analyze`}
          label="Analyze"
          Icon={LineChart}
          active={mode === "analyze"}
          onClick={rememberDomain}
        />
      </div>
      <div className="mx-auto max-w-5xl border-t border-muted/20" />
    </nav>
  );
}
