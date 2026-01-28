import Link from "next/link";

export default function TrainingCalendarPage() {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-3 flex justify-end">
        <Link href="/lifeswitch" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30">
          Back
        </Link>
      </div>

      <div className="text-lg font-semibold">Training · Calendar</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Next: top calendar strip + daily session list + quick entry. LocalStorage first, DB later.
      </div>

      <div className="mt-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Placeholder. We will implement: session_day view + session_set rows + “Add set” controls.
      </div>
    </div>
  );
}
