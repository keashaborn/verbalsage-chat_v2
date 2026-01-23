import Link from "next/link";

export default function LifeSwitchPage() {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="text-lg font-semibold">LifeSwitch</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Nutrition, training, and biometrics.
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link
          href="/lifeswitch/nutrition/foods"
          className="rounded-lg border p-4 hover:bg-muted/40"
        >
          <div className="text-sm font-medium">Foods</div>
          <div className="mt-1 text-xs text-muted-foreground">
            USDA search → import → My Foods library
          </div>
        </Link>

        <Link
          href="/lifeswitch/nutrition"
          className="rounded-lg border p-4 hover:bg-muted/40"
        >
          <div className="text-sm font-medium">Nutrition</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Meal plans and daily structure (current page)
          </div>
        </Link>

        <Link
          href="/lifeswitch/training"
          className="rounded-lg border p-4 hover:bg-muted/40"
        >
          <div className="text-sm font-medium">Training</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Programs and workout logging
          </div>
        </Link>

        <Link
          href="/lifeswitch/measurements"
          className="rounded-lg border p-4 hover:bg-muted/40"
        >
          <div className="text-sm font-medium">Measurements</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Body metrics (rename to Biometrics later)
          </div>
        </Link>
      </div>
    </div>
  );
}
