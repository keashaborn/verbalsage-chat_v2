import Link from "next/link";

export default function LifeSwitchHome() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">LifeSwitch</h1>
        <div className="mt-1 text-sm text-muted-foreground">
          Nutrition, training, and measurements.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium">Nutrition</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Build a personal food library, then assemble meal plans from it.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30" href="/lifeswitch/nutrition/foods">
              My Foods
            </Link>
            <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30" href="/lifeswitch/nutrition/meal-plans">
              Meal Plans
            </Link>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium">Training</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Workouts and exercise planning.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30" href="/lifeswitch/training">
              Training
            </Link>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium">Measurements</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Track biometrics over time.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30" href="/lifeswitch/measurements">
              Measurements
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
