"use client";

import * as React from "react";
import SSLGModal from "@/components/sslg/SSLGModal";
import type { SSLGPanelProps } from "@/components/sslg/SSLGPanel";

export type SSLGModalLauncherProps = Omit<SSLGPanelProps, "embedded"> & {
  buttonLabel?: string;
  buttonClassName?: string;
  modalTitle?: string;
};

export default function SSLGModalLauncher({
  buttonLabel = "Open SSLG",
  buttonClassName = "rounded-lg bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/60",
  modalTitle = "SSLG",
  ...panelProps
}: SSLGModalLauncherProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button className={buttonClassName} onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      <SSLGModal open={open} onOpenChange={setOpen} title={modalTitle} {...(panelProps as any)} />
    </>
  );
}
