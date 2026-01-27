import Link from "next/link";

export default function TrainingHubPage() {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-3 flex justify-end">
        <Link href="/lifeswitch" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30">
          Back
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Training</h1>
        <div className="mt-1 text-sm text-muted-foreground">
          Search exercises → save My Exercises → build workout templates → log sessions on a calendar.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/lifeswitch/training/exercises" className="rounded-lg border bg-card p-4 hover:bg-muted/30">
          <div className="text-sm font-medium">Exercises</div>
          <div className="mt-1 text-xs text-muted-foreground">Search catalog and manage My Exercises</div>
        </Link>

        <Link href="/lifeswitch/training/workouts" className="rounded-lg border bg-card p-4 hover:bg-muted/30">
          <div className="text-sm font-medium">Workouts</div>
          <div className="mt-1 text-xs text-muted-foreground">Build reusable workout templates from My Exercises</div>
        </Link>

        <Link href="/lifeswitch/training/calendar" className="rounded-lg border bg-card p-4 hover:bg-muted/30">
          <div className="text-sm font-medium">Calendar</div>
          <div className="mt-1 text-xs text-muted-foreground">Daily log with top calendar + quick entry</div>
        </Link>
      </div>
    </div>
  );
}
