import Link from "next/link";

export default function LifeSwitchHomePage() {
  return (
    <div className="mx-auto max-w-5xl p-4 overflow-x-hidden">
      <div className="mb-3 flex justify-end">
        <Link href="/" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30">
          Back
        </Link>
      </div>

      <div className="text-lg font-semibold">Life Switch</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Nutrition + training + measurements. Build templates, then log daily.
      </div>

      <div className="mt-5 grid gap-4">
        {/* NUTRITION */}
        <section className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-semibold">Nutrition</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Import foods → build meals → build day templates.
              </div>
            </div>
            <Link
              href="/lifeswitch/nutrition"
              className="shrink-0 rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30"
            >
              Open
            </Link>
          </div>

          <div className="mt-4 grid gap-3">
            <Link href="/lifeswitch/nutrition/foods" className="rounded-lg border bg-card p-4 hover:bg-muted/30">
              <div className="text-sm font-medium">My Foods</div>
              <div className="mt-1 text-xs text-muted-foreground">USDA search + import into your private library.</div>
            </Link>

            <Link href="/lifeswitch/nutrition/meals" className="rounded-lg border bg-card p-4 hover:bg-muted/30">
              <div className="text-sm font-medium">Meals</div>
              <div className="mt-1 text-xs text-muted-foreground">Meal templates with typical grams per item.</div>
            </Link>

            <Link href="/lifeswitch/nutrition/meal-plans" className="rounded-lg border bg-card p-4 hover:bg-muted/30">
              <div className="text-sm font-medium">Meal Plans</div>
              <div className="mt-1 text-xs text-muted-foreground">Day templates (targets move to Measurements).</div>
            </Link>
          </div>
        </section>

        {/* TRAINING */}
        <section className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-semibold">Training</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Search exercises → save My Exercises → build workout templates → log sessions on a calendar.
              </div>
            </div>
            <Link
              href="/lifeswitch/training"
              className="shrink-0 rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30"
            >
              Open
            </Link>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 [@media(pointer:coarse)]:grid-cols-1">
            <Link
              href="/lifeswitch/training/exercises"
              className="rounded-lg border bg-card p-4 hover:bg-muted/30"
            >
              <div className="text-sm font-medium">Exercises</div>
              <div className="mt-1 text-xs text-muted-foreground">Search catalog and manage My Exercises.</div>
            </Link>

            <Link
              href="/lifeswitch/training/workouts"
              className="rounded-lg border bg-card p-4 hover:bg-muted/30"
            >
              <div className="text-sm font-medium">Workouts</div>
              <div className="mt-1 text-xs text-muted-foreground">Build reusable workout templates.</div>
            </Link>

            <Link
              href="/lifeswitch/training/calendar"
              className="rounded-lg border bg-card p-4 hover:bg-muted/30 md:col-span-2 [@media(pointer:coarse)]:col-span-1"
            >
              <div className="text-sm font-medium">Calendar</div>
              <div className="mt-1 text-xs text-muted-foreground">Daily log + quick entry.</div>
            </Link>
          </div>
        </section>

        {/* MEASUREMENTS */}
        <section className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-semibold">Measurements</div>
              <div className="mt-1 text-sm text-muted-foreground">Biometrics + targets/TDEE (cut/bulk/maintain).</div>
            </div>
            <Link
              href="/lifeswitch/measurements"
              className="shrink-0 rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30"
            >
              Open
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
