import Link from "next/link";

export default function LifeSwitchHome() {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-3 flex justify-end">
        <Link href="/" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30">
          Exit
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">LifeSwitch</h1>
        <div className="mt-1 text-sm text-muted-foreground">Nutrition, training, and measurements.</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium">Nutrition</div>
          <div className="mt-1 text-xs text-muted-foreground">Import foods → build meals → build day templates.</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30" href="/lifeswitch/nutrition/foods">
              My Foods
            </Link>
            <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30" href="/lifeswitch/nutrition/meals">
              Meals
            </Link>
            <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30" href="/lifeswitch/nutrition/meal-plans">
              Meal Plans
            </Link>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium">Training</div>
          <div className="mt-1 text-xs text-muted-foreground">Workout templates + session logging.</div>
          <div className="mt-3">
            <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30" href="/lifeswitch/training">
              Training
            </Link>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium">Measurements</div>
          <div className="mt-1 text-xs text-muted-foreground">Biometrics + targets/TDEE (cut/bulk/maintain).</div>
          <div className="mt-3">
            <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30" href="/lifeswitch/measurements">
              Measurements
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
