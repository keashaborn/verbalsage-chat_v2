import type { ReactNode } from "react";
import { SegmentTabs } from "@/components/lifeswitch/SegmentTabs";

export default function NutritionDesignLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-4">
      <div>
        <div className="text-lg font-semibold">Nutrition · Library</div>

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
