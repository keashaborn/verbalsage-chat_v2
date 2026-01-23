"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";

type LifeSwitchDrawerProps = {
  trigger: React.ReactNode;
};

function navTo(href: string) {
  // Keep it simple; this is a dev-only UX primitive for now.
  window.location.assign(href);
}

export function LifeSwitchDrawer({ trigger }: LifeSwitchDrawerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9998] bg-black/40" />
        <Dialog.Content className="fixed left-0 top-0 z-[9999] h-svh w-[360px] max-w-[92vw] border-r bg-background shadow-xl">
          <Dialog.Title className="sr-only">LifeSwitch</Dialog.Title>
          <Dialog.Description className="sr-only">Behavior-change workspace.</Dialog.Description>

          <div className="flex h-svh flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b bg-background p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">LifeSwitch</div>
                <Dialog.Close asChild>
                  <button
                    className="rounded-lg bg-muted px-2 py-1 text-sm font-semibold hover:bg-muted/60"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </Dialog.Close>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Studio (workspace)</div>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-3 p-3">
              <div className="rounded-xl border p-3">
                <div className="text-sm font-semibold">Nutrition</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Import foods → build meals → build day templates.
                </div>
                <div className="mt-3 grid gap-2">
                  <button
                    className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/30"
                    onClick={() => {
                      setOpen(false);
                      navTo("/lifeswitch/nutrition/foods");
                    }}
                  >
                    My Foods
                    <div className="text-xs text-muted-foreground">USDA search + import into your private library.</div>
                  </button>

                  <button
                    className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/30"
                    onClick={() => {
                      setOpen(false);
                      navTo("/lifeswitch/nutrition/meals");
                    }}
                  >
                    Meals
                    <div className="text-xs text-muted-foreground">Meal templates with typical grams per item.</div>
                  </button>

                  <button
                    className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/30"
                    onClick={() => {
                      setOpen(false);
                      navTo("/lifeswitch/nutrition/meal-plans");
                    }}
                  >
                    Meal Plans
                    <div className="text-xs text-muted-foreground">Day templates (targets move to Measurements).</div>
                  </button>
                </div>
              </div>

              <button
                className="w-full rounded-xl border p-3 text-left hover:bg-muted/30"
                onClick={() => {
                  setOpen(false);
                  navTo("/lifeswitch/training");
                }}
              >
                <div className="text-sm font-semibold">Training</div>
                <div className="text-xs text-muted-foreground">Workout templates + session logging.</div>
              </button>

              <button
                className="w-full rounded-xl border p-3 text-left hover:bg-muted/30"
                onClick={() => {
                  setOpen(false);
                  navTo("/lifeswitch/measurements");
                }}
              >
                <div className="text-sm font-semibold">Measurements</div>
                <div className="text-xs text-muted-foreground">Biometrics + targets/TDEE (cut/bulk/maintain).</div>
              </button>
            </div>

            {/* Footer */}
            <div className="border-t p-3 text-xs text-muted-foreground">
              
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
