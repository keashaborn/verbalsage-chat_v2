import Link from "next/link";

export default function NutritionHome() {
  return (
    <div className="grid gap-4">
      <div>
        <div className="text-lg font-semibold">Nutrition</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Review intake, manage foods and meals, capture entries, and analyze adherence.
        </div>
      </div>

      <div className="grid gap-3">
        <Link href="/lifeswitch/nutrition/log" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Log</div>
          <div className="mt-1 text-xs text-muted-foreground">Daily entries, totals, and recent adherence.</div>
        </Link>

        <Link href="/lifeswitch/nutrition/design" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Library</div>
          <div className="mt-1 text-xs text-muted-foreground">Foods, meals, meal plans, and reusable defaults.</div>
        </Link>

        <Link href="/lifeswitch/nutrition/capture" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Capture</div>
          <div className="mt-1 text-xs text-muted-foreground">Log foods or meals repeatedly without leaving the capture flow.</div>
        </Link>

        <Link href="/lifeswitch/plan#nutrition-targets" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Plan</div>
          <div className="mt-1 text-xs text-muted-foreground">Calories, protein, macro targets, and nutrition monitoring rules.</div>
        </Link>

        <Link href="/lifeswitch/nutrition/analyze" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Analyze</div>
          <div className="mt-1 text-xs text-muted-foreground">Trends, adherence, logged days, and target fit.</div>
        </Link>
      </div>
    </div>
  );
}
