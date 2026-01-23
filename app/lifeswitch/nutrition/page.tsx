import Link from "next/link";

export default function NutritionHubPage() {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="text-lg font-semibold">Nutrition</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Separate flows: My Foods (search/import/correct) → Meal Plans (assemble) → later: daily logging.
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/lifeswitch/nutrition/foods" className="rounded-lg border p-4 hover:bg-muted/40">
          <div className="text-sm font-medium">My Foods</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Search (USDA) + import into your private foods library
          </div>
        </Link>

        <Link href="/lifeswitch/nutrition/meals" className="rounded-lg border p-4 hover:bg-muted/40">
          <div className="text-sm font-medium">Meals</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Create reusable meal templates and set typical grams per item
          </div>
        </Link>

        <Link href="/lifeswitch/nutrition/meal-plans" className="rounded-lg border p-4 hover:bg-muted/40">
          <div className="text-sm font-medium">Meal Plans</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Build day templates from meals (scheduling/logging later)
          </div>
        </Link>
      </div>
    </div>
  );
}
