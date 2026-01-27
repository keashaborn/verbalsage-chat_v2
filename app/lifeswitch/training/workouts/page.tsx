import Link from "next/link";

export default function TrainingWorkoutsPage() {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-3 flex justify-end gap-2">
        <Link href="/lifeswitch/training" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30">
          Back
        </Link>
      </div>

      <div className="text-lg font-semibold">Training · Workouts</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Next: build templates from My Exercises (like My Foods → Meals).
      </div>

      <div className="mt-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Placeholder. We will implement: workout_template → workout_template_exercise, localStorage first, DB later.
      </div>
    </div>
  );
}
