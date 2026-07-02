"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type LifeSwitchToolPanelProps = {
  title: string;
  subtitle?: string;
  storageKey: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function LifeSwitchToolPanel({
  title,
  subtitle,
  storageKey,
  defaultOpen = false,
  children,
}: LifeSwitchToolPanelProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "open") setOpen(true);
      if (stored === "closed") setOpen(false);
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, open ? "open" : "closed");
    } catch {
      // ignore
    }
  }, [hydrated, open, storageKey]);

  return (
    <section className="rounded-xl border bg-muted/10">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/20 active:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>

        <div className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground">
          Actions
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </div>
      </button>

      {open ? <div className="border-t p-4">{children}</div> : null}
    </section>
  );
}
