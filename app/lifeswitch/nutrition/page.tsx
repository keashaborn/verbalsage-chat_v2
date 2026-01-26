import Link from "next/link";

export default function NutritionHubPage() {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-3 flex justify-end">
          <Link href="/lifeswitch" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30">
            Exit
          </Link>
      </div>

      <div className="text-lg font-semibold">LifeSwitch</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Nutrition and training tools. Nutrition flow: My Foods (search/import/correct) → Meals → Meal Plans → later: daily logging.
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/lifeswitch" className="rounded-lg border p-4 hover:bg-muted/40">
          <div className="text-sm font-medium">Nutrition</div>
          <div className="mt-1 text-xs text-muted-foreground">Go to the nutrition hub</div>
        </Link>

        <Link href="/lifeswitch/nutrition/foods" className="rounded-lg border p-4 hover:bg-muted/40">
          <div className="text-sm font-medium">My Foods</div>
          <div className="mt-1 text-xs text-muted-foreground">Search (USDA) + import into your private foods library</div>
        </Link>

        <Link href="/lifeswitch/nutrition/meals" className="rounded-lg border p-4 hover:bg-muted/40">
          <div className="text-sm font-medium">Meals</div>
          <div className="mt-1 text-xs text-muted-foreground">Create reusable meal templates and set typical grams per item</div>
        </Link>

        <Link href="/lifeswitch/nutrition/meal-plans" className="rounded-lg border p-4 hover:bg-muted/40">
          <div className="text-sm font-medium">Meal Plans</div>
          <div className="mt-1 text-xs text-muted-foreground">Build day templates from meals (scheduling/logging later)</div>
        </Link>

        <Link href="/lifeswitch/training" className="rounded-lg border p-4 hover:bg-muted/40">
          <div className="text-sm font-medium">Training</div>
          <div className="mt-1 text-xs text-muted-foreground">Workout library + sessions</div>
        </Link>

        <Link href="/lifeswitch/measurements" className="rounded-lg border p-4 hover:bg-muted/40">
          <div className="text-sm font-medium">Measurements</div>
          <div className="mt-1 text-xs text-muted-foreground">Body metrics, targets (WIP)</div>
        </Link>
      </div>
    </div>
  );
}
