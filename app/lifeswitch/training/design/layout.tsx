import type { ReactNode } from "react";
import { SegmentTabs } from "@/components/lifeswitch/SegmentTabs";

export default function TrainingDesignLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6">
      <header>
        <div className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Training
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Workouts</h1>
      </header>

      <SegmentTabs
        segments={[
          { href: "/lifeswitch/training/design/workouts", label: "Workouts" },
          { href: "/lifeswitch/training/design/conditioning", label: "Conditioning" },
          { href: "/lifeswitch/training/design/exercises", label: "Exercises" },
        ]}
      />

      {children}
    </div>
  );
}
