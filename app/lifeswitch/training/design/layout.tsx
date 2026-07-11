import type { ReactNode } from "react";
import { SegmentTabs } from "@/components/lifeswitch/SegmentTabs";

export default function TrainingDesignLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4">
      <div>
        <div className="text-lg font-semibold">Training · Workouts</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Build workout templates directly from the catalog or your exercise library.
        </div>
      </div>

      <SegmentTabs
        segments={[
          { href: "/lifeswitch/training/design/workouts", label: "Workouts" },
          { href: "/lifeswitch/training/design/conditioning", label: "Conditioning" },
          { href: "/lifeswitch/training/design/exercises", label: "My Training Library" },
        ]}
      />

      {children}
    </div>
  );
}
