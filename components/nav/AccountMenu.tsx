"use client";

import * as React from "react";
import { SettingsDrawer } from "@/components/admin/SettingsDrawer";

type AccountMenuProps = {
  label?: string;
};

export function AccountMenu({ label = "Account" }: AccountMenuProps) {
  return (
    <SettingsDrawer
      trigger={
        <button
          type="button"
          className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/30 active:bg-muted/40"
          aria-label="Open account and settings"
          title="Account and settings"
        >
          {label}
        </button>
      }
    />
  );
}
