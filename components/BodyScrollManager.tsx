"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

const LOCK_CLASS = "vs-lock-body-scroll";

/**
 * Locks body scroll on selected routes to prevent iOS "page drag" behind fixed UI.
 * Default: allow normal page scrolling everywhere except chat-like pages.
 */
export function BodyScrollManager() {
  const pathname = usePathname() || "/";

  React.useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    // Lock scroll on main chat route(s). Adjust as needed.
    const shouldLock =
      pathname === "/" ||
      pathname.startsWith("/threads") ||
      pathname.startsWith("/chat");

    html.classList.toggle(LOCK_CLASS, shouldLock);
    body.classList.toggle(LOCK_CLASS, shouldLock);

    return () => {
      html.classList.remove(LOCK_CLASS);
      body.classList.remove(LOCK_CLASS);
    };
  }, [pathname]);

  return null;
}
