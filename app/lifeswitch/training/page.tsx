import Link from "next/link";

export default function TrainingHome() {
  return (
    <div className="grid gap-4">
      <div>
        <div className="text-lg font-semibold">Training</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Review consistency, build workouts, capture sessions, then analyze progression.
        </div>
      </div>

      <div className="grid gap-3">
        <Link href="/lifeswitch/training/log" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Log</div>
          <div className="mt-1 text-xs text-muted-foreground">Calendar, completed sessions, sets, and volume.</div>
        </Link>

        <Link href="/lifeswitch/training/design/workouts" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Workouts</div>
          <div className="mt-1 text-xs text-muted-foreground">Build reusable workout templates from catalog or custom exercises.</div>
        </Link>

        <Link href="/lifeswitch/training/capture" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Capture</div>
          <div className="mt-1 text-xs text-muted-foreground">Run today’s workout and finish it into the log.</div>
        </Link>

        <Link href="/lifeswitch/training/plan" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Plan</div>
          <div className="mt-1 text-xs text-muted-foreground">Programs / schedule (later).</div>
        </Link>

        <Link href="/lifeswitch/training/analyze" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Analyze</div>
          <div className="mt-1 text-xs text-muted-foreground">Trends, volume, PRs (later).</div>
        </Link>
      </div>
    </div>
  );
}
