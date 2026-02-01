import type { ReactNode } from "react";
import { SegmentTabs } from "@/components/lifeswitch/SegmentTabs";

export default function NutritionDesignLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4">
      <div>
        <div className="text-lg font-semibold">Nutrition · Design</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Build foods and meals used by logging and plans.
        </div>
      </div>

      <SegmentTabs
        segments={[
          { href: "/lifeswitch/nutrition/design/foods", label: "Foods" },
          { href: "/lifeswitch/nutrition/design/meals", label: "Meals" },
        ]}
      />

      {children}
    </div>
  );
}
