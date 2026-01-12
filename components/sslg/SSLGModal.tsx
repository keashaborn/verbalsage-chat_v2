"use client";

import * as React from "react";
import SSLGPanel, { type SSLGPanelProps } from "@/components/sslg/SSLGPanel";

export type SSLGModalProps = Omit<SSLGPanelProps, "embedded"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
};

export default function SSLGModal({ open, onOpenChange, title = "SSLG", ...panelProps }: SSLGModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/60" onClick={() => onOpenChange(false)} />
      <div className="absolute inset-0 overflow-auto p-4 md:p-8">
        <div className="mx-auto w-full max-w-6xl rounded-2xl border bg-background shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="text-sm font-semibold">{title}</div>
            <button
              className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60"
              onClick={() => onOpenChange(false)}
            >
              Close
            </button>
          </div>
          <div className="p-2 md:p-4">
            <SSLGPanel embedded={true} {...panelProps} />
          </div>
        </div>
      </div>
    </div>
  );
}
