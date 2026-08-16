import { Suspense } from "react";

import { PlanProfileClient } from "@/components/lifeswitch/plan/PlanProfileClient";

export default function LifeSwitchPlanPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto grid max-w-6xl gap-4 p-4 pb-24 md:p-6">
          <div className="rounded-lg border bg-background p-5 shadow-sm">
            <div className="text-sm text-muted-foreground">
              Loading LifeSwitch plan…
            </div>
          </div>
        </div>
      }
    >
      <PlanProfileClient />
    </Suspense>
  );
}
