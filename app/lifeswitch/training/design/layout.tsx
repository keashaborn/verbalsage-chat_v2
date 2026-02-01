import type { ReactNode } from "react";
import { SegmentTabs } from "@/components/lifeswitch/SegmentTabs";

export default function TrainingDesignLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4">
      <div>
        <div className="text-lg font-semibold">Training · Design</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Build exercises and workout templates used by capture and logging.
        </div>
      </div>

      <SegmentTabs
        segments={[
          { href: "/lifeswitch/training/design/exercises", label: "Exercises" },
          { href: "/lifeswitch/training/design/workouts", label: "Workouts" },
        ]}
      />

      {children}
    </div>
  );
}
