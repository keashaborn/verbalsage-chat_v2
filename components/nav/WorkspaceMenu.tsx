"use client";

import * as React from "react";
import Link from "next/link";
import { useSiteBrand } from "@/components/site/SiteBrandProvider";

type WorkspaceMenuProps = {
  label?: string;
  align?: "left" | "right";
  variant?: "button" | "plain";
};

const WORKSPACE_LINKS = [{ href: "/", label: "Chat" }];

const LIFESWITCH_LINKS = [
  { href: "/lifeswitch/nutrition", label: "Nutrition" },
  { href: "/lifeswitch/training", label: "Training" },
  { href: "/lifeswitch/measurements", label: "Measurements" },
];

export function WorkspaceMenu({
  label,
  align = "right",
  variant = "button",
}: WorkspaceMenuProps) {
  const { siteId, brand } = useSiteBrand();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const node = ref.current;
      if (!node) return;
      if (event.target instanceof Node && node.contains(event.target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const triggerClass =
    variant === "plain"
      ? "product-brand-trigger min-h-11 rounded-md px-1 py-1.5 text-sm font-semibold tracking-wide hover:opacity-80 sm:min-h-0"
      : "product-brand-trigger min-h-11 rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30 sm:min-h-0";

  const panelClass = [
    "absolute z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border/70 bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/5 supports-[backdrop-filter]:bg-popover/95 supports-[backdrop-filter]:backdrop-blur-xl",
    align === "left" ? "left-0" : "right-0",
  ].join(" ");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={triggerClass}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label || brand.name} ▾
      </button>

      {open ? (
        <div className={panelClass} role="menu">
          <div className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Workspace
          </div>
          {WORKSPACE_LINKS.map((item) => (
            <MenuLink
              key={item.href}
              href={item.href}
              onNavigate={() => setOpen(false)}
            >
              {item.label}
            </MenuLink>
          ))}

          {siteId === "lifeswitch" ? (
            <>
              <div className="mt-1 border-t" />
              <div className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                LifeSwitch
              </div>
              {LIFESWITCH_LINKS.map((item) => (
                <MenuLink
                  key={item.href}
                  href={item.href}
                  onNavigate={() => setOpen(false)}
                >
                  {item.label}
                </MenuLink>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  children,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 text-sm hover:bg-muted/60"
      role="menuitem"
      onClick={onNavigate}
    >
      {children}
    </Link>
  );
}
