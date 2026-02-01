import Link from "next/link";

export default function NutritionPlan() {
  return (
    <div className="grid gap-3">
      <div className="text-lg font-semibold">Nutrition · Plan</div>
      <div className="text-sm text-muted-foreground">Targets + day templates (meal plans).</div>

      <Link href="/lifeswitch/nutrition/meal-plans" className="rounded-xl border p-4 hover:bg-muted/30">
        <div className="text-sm font-semibold">Meal Plans</div>
        <div className="mt-1 text-xs text-muted-foreground">Day templates built from meals.</div>
      </Link>
    </div>
  );
}
