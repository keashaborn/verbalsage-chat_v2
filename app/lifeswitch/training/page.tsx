import Link from "next/link";

export default function TrainingHome() {
  return (
    <div className="grid gap-4">
      <div>
        <div className="text-lg font-semibold">Training</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Library templates, log sessions, plan weeks, analyze volume/progression.
        </div>
      </div>

      <div className="grid gap-3">
        <Link href="/lifeswitch/training/design" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Library</div>
          <div className="mt-1 text-xs text-muted-foreground">Exercises + workout templates.</div>
        </Link>

        <Link href="/lifeswitch/training/plan" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Plan</div>
          <div className="mt-1 text-xs text-muted-foreground">Programs / schedule (later).</div>
        </Link>

        <Link href="/lifeswitch/training/log" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Log</div>
          <div className="mt-1 text-xs text-muted-foreground">Calendar + sessions.</div>
        </Link>

        <Link href="/lifeswitch/training/analyze" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Analyze</div>
          <div className="mt-1 text-xs text-muted-foreground">Trends, volume, PRs (later).</div>
        </Link>
      </div>
    </div>
  );
}
