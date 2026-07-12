"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type LifeSwitchToolPanelProps = {
  title: string;
  subtitle?: string;
  storageKey?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function LifeSwitchToolPanel({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: LifeSwitchToolPanelProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <section className="rounded-xl border bg-muted/10">
      <button
        type="button"
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/20 active:bg-muted/30"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>

        <div className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
          {open ? "Close" : "Open"}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open ? <div className="border-t p-4">{children}</div> : null}
    </section>
  );
}
