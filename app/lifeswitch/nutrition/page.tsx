import Link from "next/link";

export default function NutritionHome() {
  return (
    <div className="grid gap-4">
      <div>
        <div className="text-lg font-semibold">Nutrition</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Library foods/meals, plan days, log intake, analyze trends.
        </div>
      </div>

      <div className="grid gap-3">
        <Link href="/lifeswitch/nutrition/design" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Library</div>
          <div className="mt-1 text-xs text-muted-foreground">Foods, meals, templates.</div>
        </Link>

        <Link href="/lifeswitch/nutrition/plan" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Plan</div>
          <div className="mt-1 text-xs text-muted-foreground">Day templates / meal plans.</div>
        </Link>

        <Link href="/lifeswitch/nutrition/log" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Log</div>
          <div className="mt-1 text-xs text-muted-foreground">Daily entries (calendar/list).</div>
        </Link>

        <Link href="/lifeswitch/nutrition/analyze" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Analyze</div>
          <div className="mt-1 text-xs text-muted-foreground">Trends and adherence.</div>
        </Link>
      </div>
    </div>
  );
}
