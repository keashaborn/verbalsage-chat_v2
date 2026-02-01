import Link from "next/link";

export default function TrainingDesignHub() {
  return (
    <div className="grid gap-3">
      <div className="text-lg font-semibold">Training · Design</div>
      <div className="text-sm text-muted-foreground">Build exercises and workout templates.</div>

      <Link href="/lifeswitch/training/exercises" className="rounded-xl border p-4 hover:bg-muted/30">
        <div className="text-sm font-semibold">Exercises</div>
        <div className="mt-1 text-xs text-muted-foreground">Catalog search + My Exercises.</div>
      </Link>

      <Link href="/lifeswitch/training/workouts" className="rounded-xl border p-4 hover:bg-muted/30">
        <div className="text-sm font-semibold">Workouts</div>
        <div className="mt-1 text-xs text-muted-foreground">Templates built from My Exercises.</div>
      </Link>
    </div>
  );
}
