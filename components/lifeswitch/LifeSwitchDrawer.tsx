"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";

type LifeSwitchDrawerProps = {
  trigger: React.ReactNode;
};

const BRAND_FILTER_SILVER = "grayscale brightness-125 contrast-125 opacity-85";

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
            <div className="sticky top-0 z-10 border-b bg-background">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="relative" style={{ height: 16, width: 140 }}>
                  <Image
                    src="/brand/ls-wordmark.norm.svg"
                    alt="LifeSwitch"
                    fill
                    sizes="140px"
                    className={`object-contain object-left ${BRAND_FILTER_SILVER} scale-[.80] origin-left`}
                  />
                </div>

                <Dialog.Close
                  aria-label="Close"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-background/60 text-foreground hover:bg-muted"
                >
                  <span className="text-lg leading-none">×</span>
                </Dialog.Close>
              </div>
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
                    <button
                      className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/30"
                      onClick={() => {
                        setOpen(false);
                        navTo("/lifeswitch/nutrition");
                      }}
                    >
                      Nutrition Home
                      <div className="text-xs text-muted-foreground">Log, quick actions, and entry points for nutrition.</div>
                    </button>

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

              <div className="rounded-xl border p-3">
                <div className="text-sm font-semibold">Training</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Search exercises → build workouts → log sessions.
                </div>

                <div className="mt-3 grid gap-2">
                  <button
                    className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/30"
                    onClick={() => {
                      setOpen(false);
                      navTo("/lifeswitch/training/exercises");
                    }}
                  >
                    <button
                      className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/30"
                      onClick={() => {
                        setOpen(false);
                        navTo("/lifeswitch/training");
                      }}
                    >
                      Training Home
                      <div className="text-xs text-muted-foreground">Log, quick actions, and entry points for training.</div>
                    </button>

                    Exercises
                    <div className="text-xs text-muted-foreground">Search catalog + manage My Exercises.</div>
                  </button>

                  <button
                    className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/30"
                    onClick={() => {
                      setOpen(false);
                      navTo("/lifeswitch/training/workouts");
                    }}
                  >
                    Workouts
                    <div className="text-xs text-muted-foreground">Workout templates built from My Exercises.</div>
                  </button>

                  <button
                    className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/30"
                    onClick={() => {
                      setOpen(false);
                      navTo("/lifeswitch/training/calendar");
                    }}
                  >
                    Calendar
                    <div className="text-xs text-muted-foreground">Daily log + quick entry.</div>
                  </button>
                </div>
              </div>

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
