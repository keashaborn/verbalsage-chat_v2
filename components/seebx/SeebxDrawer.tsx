"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";

type SeebxDrawerProps = {
  trigger: React.ReactNode;
};

function navTo(href: string) {
  window.location.assign(href);
}

export function SeebxDrawer({ trigger }: SeebxDrawerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9998] bg-black/40" />
        <Dialog.Content className="fixed left-0 top-0 z-[9999] h-svh w-[360px] max-w-[92vw] border-r bg-background shadow-xl">
          <Dialog.Title className="sr-only">SeeBx</Dialog.Title>
          <Dialog.Description className="sr-only">Behavior workspace.</Dialog.Description>

          <div className="flex h-svh flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b bg-background p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">SeeBx</div>
                <Dialog.Close asChild>
                  <button
                    className="rounded-lg bg-muted px-2 py-1 text-sm font-semibold hover:bg-muted/60"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </Dialog.Close>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Workspace</div>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-3 p-3">
              <button
                className="w-full rounded-xl border p-3 text-left hover:bg-muted/30"
                onClick={() => {
                  setOpen(false);
                  navTo("/collect");
                }}
              >
                <div className="text-sm font-semibold">Capture</div>
                <div className="text-xs text-muted-foreground">Data capture workspace.</div>
              </button>

              <button
                className="w-full rounded-xl border p-3 text-left hover:bg-muted/30"
                onClick={() => {
                  setOpen(false);
                  navTo("/developer/forms");
                }}
              >
                <div className="text-sm font-semibold">Design</div>
                <div className="text-xs text-muted-foreground">Program/template design.</div>
              </button>

              <button
                className="w-full rounded-xl border p-3 text-left hover:bg-muted/30"
                onClick={() => {
                  setOpen(false);
                  navTo("/developer/sslg");
                }}
              >
                <div className="text-sm font-semibold">SSLG</div>
                <div className="text-xs text-muted-foreground">Single-subject line graph.</div>
              </button>
            </div>

            <div className="border-t p-3 text-xs text-muted-foreground">
              v0. Links are temporary; we’ll move routes out of /developer once the nav is stable.
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
