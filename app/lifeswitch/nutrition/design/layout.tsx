import type { ReactNode } from "react";
import { SegmentTabs } from "@/components/lifeswitch/SegmentTabs";

export default function NutritionDesignLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-4">
      <div>
        <h1 className="text-lg font-semibold">Nutrition · Library</h1>

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
