"use client";

import * as React from "react";

export function SettingsRow({
  label,
  value,
  onClick,
  disabled,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onClick}
      disabled={disabled}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{label}</div>
      </div>

      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        {value != null && <div className="max-w-[160px] truncate">{value}</div>}
        <div aria-hidden className="text-base leading-none">
          ›
        </div>
      </div>
    </button>
  );
}
