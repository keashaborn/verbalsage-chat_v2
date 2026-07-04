"use client";

import * as React from "react";
import Link from "next/link";

type WorkspaceMenuProps = {
  label?: string;
  align?: "left" | "right";
  variant?: "button" | "plain";
};

export function WorkspaceMenu({
  label = "Menu",
  align = "right",
  variant = "button",
}: WorkspaceMenuProps) {
  const ref = React.useRef<HTMLDetailsElement | null>(null);

  function close() {
    if (ref.current) ref.current.open = false;
  }

  const item =
    "block px-3 py-2 text-sm hover:bg-muted/30 active:bg-muted/40";

  const summaryClass =
    variant === "plain"
      ? "list-none cursor-pointer select-none rounded-md px-1 py-1.5 text-sm font-semibold tracking-wide hover:opacity-80 [&::-webkit-details-marker]:hidden"
      : "list-none cursor-pointer select-none rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30 [&::-webkit-details-marker]:hidden";

  const panelClass = [
    "absolute z-50 mt-2 w-48 overflow-hidden rounded-xl border bg-background shadow-lg",
    align === "left" ? "left-0" : "right-0",
  ].join(" ");

  return (
    <details ref={ref} className="relative">
      <summary className={summaryClass}>
        {label} ▾
      </summary>

      <div className={panelClass}>
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Workspace
        </div>

          <Link href="/" onClick={close} className={item}>
            Chat
          </Link>

          <div className="my-1 border-t border-muted/20" />

          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            LifeSwitch
          </div>
          <Link href="/lifeswitch/plan" onClick={close} className={item}>
            Plan
          </Link>
          <Link href="/lifeswitch/nutrition/log" onClick={close} className={item}>
            Nutrition
          </Link>
          <Link href="/lifeswitch/training/calendar" onClick={close} className={item}>
            Training
          </Link>
          <Link href="/lifeswitch/measurements" onClick={close} className={item}>
            Measurements
          </Link>
          <Link href="/lifeswitch/people" onClick={close} className={item}>
            People
          </Link>
      </div>
    </details>
  );
}
