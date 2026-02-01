"use client";

import * as React from "react";
import Link from "next/link";

type WorkspaceMenuProps = {
  label?: string;
};

export function WorkspaceMenu({ label = "Menu" }: WorkspaceMenuProps) {
  const ref = React.useRef<HTMLDetailsElement | null>(null);

  function close() {
    if (ref.current) ref.current.open = false;
  }

  const item =
    "block px-3 py-2 text-sm hover:bg-muted/30 active:bg-muted/40";

  return (
    <details ref={ref} className="relative">
      <summary className="list-none cursor-pointer select-none rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
        {label} ▾
      </summary>

      <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border bg-background shadow-lg">
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Workspace
        </div>

        <Link href="/" onClick={close} className={item}>
          Back to Chat
        </Link>
        <Link href="/collect" onClick={close} className={item}>
          Capture
        </Link>
        <Link href="/lifeswitch" onClick={close} className={item}>
          LifeSwitch Home
        </Link>

        <div className="my-1 border-t border-muted/20" />

        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          LifeSwitch Domains
        </div>

        <Link href="/lifeswitch/nutrition" onClick={close} className={item}>
          Nutrition
        </Link>
        <Link href="/lifeswitch/training" onClick={close} className={item}>
          Training
        </Link>
        <Link href="/lifeswitch/measurements" onClick={close} className={item}>
          Measurements
        </Link>
      </div>
    </details>
  );
}
