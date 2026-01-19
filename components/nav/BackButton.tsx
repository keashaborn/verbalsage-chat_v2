"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export default function BackButton({
  fallbackHref = "/lifeswitch",
  label = "Back",
  className = "",
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  function onClick() {
    // If there’s browser history, go back; otherwise go to a safe fallback.
    try {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
        return;
      }
    } catch { }
    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 ${className}`}
      aria-label="Back"
      title="Back"
    >
      ← {label}
    </button>
  );
}
