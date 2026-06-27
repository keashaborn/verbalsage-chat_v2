import Link from "next/link";

export default function TrainingHome() {
  return (
    <div className="grid gap-4">
      <div>
        <div className="text-lg font-semibold">Training</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Review completed sessions, build workouts, capture training, and analyze progression.
        </div>
      </div>

      <div className="grid gap-3">
        <Link href="/lifeswitch/training/calendar" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Log</div>
          <div className="mt-1 text-xs text-muted-foreground">Calendar, completed strength sessions, conditioning, sets, and volume.</div>
        </Link>

        <Link href="/lifeswitch/training/design/workouts" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Workouts</div>
          <div className="mt-1 text-xs text-muted-foreground">Build reusable workout templates from catalog, custom exercises, and conditioning prescriptions.</div>
        </Link>

        <Link href="/lifeswitch/training/capture" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Capture</div>
          <div className="mt-1 text-xs text-muted-foreground">Run today’s workout and finish it into the log.</div>
        </Link>

        <Link href="/lifeswitch/plan#training-targets" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Plan</div>
          <div className="mt-1 text-xs text-muted-foreground">Training targets, schedule, conditioning, activity, and recovery rules.</div>
        </Link>

        <Link href="/lifeswitch/training/analyze" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Analyze</div>
          <div className="mt-1 text-xs text-muted-foreground">Volume, consistency, training days, and progression trends.</div>
        </Link>
      </div>
    </div>
  );
}
