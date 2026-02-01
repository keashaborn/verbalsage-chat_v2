import Link from "next/link";

export default function TrainingPlan() {
  return (
    <div className="grid gap-3">
      <div className="text-lg font-semibold">Training · Plan</div>
      <div className="text-sm text-muted-foreground">Program structure (placeholder).</div>

      <Link href="/lifeswitch/training/workouts" className="rounded-xl border p-4 hover:bg-muted/30">
        <div className="text-sm font-semibold">Workout Templates</div>
        <div className="mt-1 text-xs text-muted-foreground">Use these to drive Capture.</div>
      </Link>
    </div>
  );
}
