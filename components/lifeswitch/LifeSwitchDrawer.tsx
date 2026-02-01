"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import Link from "next/link";

type LifeSwitchDrawerProps = {
  trigger: React.ReactNode;
};

const BRAND_FILTER_SILVER = "grayscale brightness-125 contrast-125 opacity-85";

function NavItem({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc?: string;
}) {
  return (
    <Dialog.Close asChild>
      <Link
        href={href}
        className="block w-full rounded-lg border px-3 py-2 text-left hover:bg-muted/30 active:bg-muted/40"
      >
        <div className="text-sm font-medium">{title}</div>
        {desc ? <div className="text-xs text-muted-foreground">{desc}</div> : null}
      </Link>
    </Dialog.Close>
  );
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
                  <NavItem
                    href="/lifeswitch/nutrition"
                    title="Nutrition Home"
                    desc="Log, quick actions, and entry points for nutrition."
                  />
                  <NavItem
                    href="/lifeswitch/nutrition/foods"
                    title="My Foods"
                    desc="USDA search + import into your private library."
                  />
                  <NavItem
                    href="/lifeswitch/nutrition/meals"
                    title="Meals"
                    desc="Meal templates with typical grams per item."
                  />
                  <NavItem
                    href="/lifeswitch/nutrition/meal-plans"
                    title="Meal Plans"
                    desc="Day templates (targets move to Measurements)."
                  />
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-sm font-semibold">Training</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Search exercises → build workouts → log sessions.
                </div>

                <div className="mt-3 grid gap-2">
                  <NavItem
                    href="/lifeswitch/training"
                    title="Training Home"
                    desc="Log, quick actions, and entry points for training."
                  />
                  <NavItem
                    href="/lifeswitch/training/exercises"
                    title="Exercises"
                    desc="Search catalog + manage My Exercises."
                  />
                  <NavItem
                    href="/lifeswitch/training/workouts"
                    title="Workouts"
                    desc="Workout templates built from My Exercises."
                  />
                  <NavItem
                    href="/lifeswitch/training/calendar"
                    title="Calendar"
                    desc="Daily log + quick entry."
                  />
                </div>
              </div>

              <NavItem
                href="/lifeswitch/measurements"
                title="Measurements"
                desc="Biometrics + targets/TDEE (cut/bulk/maintain)."
              />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
